const { Client } = require('pg');

async function checkEnrollments() {
    const client = new Client({
        connectionString: "postgresql://user:password@localhost:5432/openccb_lms"
    });

    try {
        await client.connect();
        console.log("Connected to LMS DB");

        console.log("\n--- Users ---");
        const users = await client.query("SELECT id, email, organization_id, full_name FROM users");
        console.table(users.rows);

        console.log("\n--- Enrollments ---");
        const enrollments = await client.query("SELECT id, user_id, course_id, organization_id FROM enrollments");
        console.table(enrollments.rows);

        console.log("\n--- Courses ---");
        const courses = await client.query("SELECT id, title, organization_id FROM courses");
        console.table(courses.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

checkEnrollments();
