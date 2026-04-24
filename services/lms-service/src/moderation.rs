/// Moderación básica por diccionario para bloquear lenguaje ofensivo en texto libre.
/// Es un primer filtro de seguridad mientras se integra una capa de IA más robusta.
fn normalize_token(token: &str) -> String {
    token
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            _ => c,
        })
        .collect()
}

fn tokenize(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.trim().is_empty())
        .map(normalize_token)
        .collect()
}

pub fn contains_inappropriate_language(text: &str) -> bool {
    const BLOCKED_TERMS: [&str; 16] = [
        "mierda",
        "idiota",
        "imbecil",
        "estupido",
        "estupida",
        "pendejo",
        "pendeja",
        "carajo",
        "puto",
        "puta",
        "fuck",
        "fucking",
        "shit",
        "bitch",
        "asshole",
        "bastard",
    ];

    const BLOCKED_PHRASES: [&str; 4] = [
        "vete al carajo",
        "go to hell",
        "piece of shit",
        "son of a bitch",
    ];

    let normalized_text = normalize_token(text);

    if BLOCKED_PHRASES
        .iter()
        .any(|phrase| normalized_text.contains(phrase))
    {
        return true;
    }

    let tokens = tokenize(text);
    tokens
        .iter()
        .any(|token| BLOCKED_TERMS.contains(&token.as_str()))
}
