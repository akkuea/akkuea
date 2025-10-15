use soroban_sdk::String;

const MAX_TEXT_SIZE: usize = 1000;

// Lightweight sentiment analysis based on keyword matching
// Returns a score from -100 (very negative) to 100 (very positive)
pub fn calculate_sentiment(text: &String) -> i32 {
    let mut score: i32 = 0;

    // Convert string to bytes for processing
    let text_len = text.len() as usize;
    if text_len == 0 || text_len > MAX_TEXT_SIZE {
        return 0; // Neutral for empty or too long
    }

    let mut buffer = [0u8; MAX_TEXT_SIZE];
    let slice = &mut buffer[..text_len];
    text.copy_into_slice(slice);

    // Positive keywords - add 15 points each
    let positive_words: [&[u8]; 19] = [
        b"good",
        b"great",
        b"excellent",
        b"amazing",
        b"wonderful",
        b"fantastic",
        b"love",
        b"best",
        b"awesome",
        b"perfect",
        b"helpful",
        b"useful",
        b"clear",
        b"easy",
        b"outstanding",
        b"brilliant",
        b"informative",
        b"engaging",
        b"valuable",
    ];

    // Negative keywords - subtract 15 points each
    let negative_words: [&[u8]; 18] = [
        b"bad",
        b"terrible",
        b"awful",
        b"poor",
        b"worst",
        b"hate",
        b"useless",
        b"unclear",
        b"difficult",
        b"confusing",
        b"boring",
        b"waste",
        b"disappointing",
        b"frustrating",
        b"inadequate",
        b"misleading",
        b"incomplete",
        b"unhelpful",
    ];

    // Count positive matches
    for word in positive_words.iter() {
        if contains_word(slice, word) {
            score += 15;
        }
    }

    // Count negative matches
    for word in negative_words.iter() {
        if contains_word(slice, word) {
            score -= 15;
        }
    }

    // Clamp score between -100 and 100
    if score > 100 {
        score = 100;
    } else if score < -100 {
        score = -100;
    }

    score
}

// Check if word exists in text with word boundaries
fn contains_word(text: &[u8], word: &[u8]) -> bool {
    let text_len = text.len();
    let word_len = word.len();

    if word_len > text_len {
        return false;
    }

    // Simple substring search
    for i in 0..=(text_len - word_len) {
        let mut matches = true;

        // Check each character
        for j in 0..word_len {
            let text_char = to_lowercase(text[i + j]);
            let word_char = to_lowercase(word[j]);

            if text_char != word_char {
                matches = false;
                break;
            }
        }

        if matches {
            // Check word boundaries (basic check)
            let is_start_boundary = i == 0 || is_delimiter(text[i - 1]);
            let end_pos = i + word_len;
            let is_end_boundary = end_pos == text_len || is_delimiter(text[end_pos]);

            if is_start_boundary && is_end_boundary {
                return true;
            }
        }
    }

    false
}

// Convert ASCII character to lowercase
fn to_lowercase(c: u8) -> u8 {
    if c >= b'A' && c <= b'Z' {
        c + 32
    } else {
        c
    }
}

// Check if character is a word delimiter
fn is_delimiter(c: u8) -> bool {
    matches!(
        c,
        b' ' | b'.' | b',' | b'!' | b'?' | b';' | b':' | b'\n' | b'\t' | b'-' | b'(' | b')'
    )
}
