import os
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image
import uuid

app = FastAPI()

# Configuration
MODEL_ID = "runwayml/stable-diffusion-v1-5"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Global variables for the model
pipe = None

def load_model():
    global pipe
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading Stable Diffusion model on {device}...")
    
    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID, 
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    )
    # Use a high-quality scheduler for better detail
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.to(device)
    
    if device == "cpu":
        pipe.enable_attention_slicing()
    
    print("Model loaded successfully.")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Model loading is heavy, we'll do it on first request to avoid timeout at startup
    yield

app = FastAPI(lifespan=lifespan)

# Serve generated images
from fastapi.staticfiles import StaticFiles
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

import psycopg2

class ImageRequest(BaseModel):
    prompt: str
    lesson_id: str
    database_url: Optional[str] = None
    table_name: str = "lessons"
    progress_column: str = "generation_progress"
    width: Optional[int] = 512
    height: Optional[int] = 512

@app.post("/generate")
async def generate_image(request: ImageRequest):
    global pipe
    if pipe is None:
        load_model()
    
    num_steps = 150
    
    def progress_callback(step: int, timestep: int, latents: torch.FloatTensor):
        if request.database_url and request.lesson_id:
            try:
                progress = int((step / num_steps) * 100)
                conn = psycopg2.connect(request.database_url)
                cur = conn.cursor()
                
                # Check for cancellation
                status_query = f"SELECT {request.table_name.replace('generation_progress', 'generation_status')} FROM {request.table_name} WHERE id = %s"
                # Wait, the column name is fixed based on table. 
                # courses -> generation_status
                # lessons -> video_generation_status
                status_col = "generation_status" if request.table_name == "courses" else "video_generation_status"
                cur.execute(f"SELECT {status_col} FROM {request.table_name} WHERE id = %s", (request.lesson_id,))
                status = cur.fetchone()[0]
                
                if status == 'idle':
                    print(f"Generation for {request.lesson_id} was cancelled. Aborting.")
                    cur.close()
                    conn.close()
                    raise Exception("Generation cancelled by user")

                # Update progress
                query = f"UPDATE {request.table_name} SET {request.progress_column} = %s WHERE id = %s"
                cur.execute(query, (progress, request.lesson_id))
                conn.commit()
                cur.close()
                conn.close()
            except Exception as db_e:
                if "cancelled" in str(db_e).lower():
                    raise db_e
                print(f"Database update error: {db_e}")

    def callback_dynamic_cfg(pipe, step_index, timestep, callback_kwargs):
        if progress_callback:
            progress_callback(step_index, timestep, None)
        return callback_kwargs

    try:
        quality_prompt = f"{request.prompt}, highly detailed, high quality, masterpiece, 8k, realistic, photographic, sharp focus, perfect anatomy"
        negative_prompt = "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, disconnected limbs, mutation, mutated, ugly, disgusting, blurry, low quality, low resolution, bad hands, extra fingers, cartoon, anime, illustration, draft, grainy"

        print(f"Generating image ({request.width}x{request.height}) for prompt: {quality_prompt}")
        
        # Generation with custom resolution
        image = pipe(
            quality_prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=num_steps,
            guidance_scale=8.5,
            width=request.width,
            height=request.height,
            callback_on_step_end=callback_dynamic_cfg
        ).images[0]
        
        # Ensure progress is 100% at the end
        if request.database_url and request.lesson_id:
            try:
                conn = psycopg2.connect(request.database_url)
                cur = conn.cursor()
                query = f"UPDATE {request.table_name} SET {request.progress_column} = 100 WHERE id = %s"
                cur.execute(query, (request.lesson_id,))
                conn.commit()
                cur.close()
                conn.close()
            except:
                pass

        image_filename = f"image_{request.lesson_id}_{uuid.uuid4().hex[:8]}.png"
        image_path = os.path.join(OUTPUT_DIR, image_filename)
        
        image.save(image_path)
        
        # Return the absolute URL pointing to t-800 so the frontend can find it
        hostname = os.getenv("BRIDGE_HOSTNAME", "t-800")
        full_url = f"http://{hostname}:8080/outputs/{image_filename}"
        
        return {"status": "completed", "url": full_url}
        
    except Exception as e:
        print(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": pipe is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
