type McQuestion = { options: string[]; correct: number };

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

/**
 * Shuffles each question's options at display time. Correct-answer positions are
 * drawn from a balanced, shuffled pool so long exams spread answers evenly across
 * أ/ب/ج/د; `correct` is recomputed so grading follows the answer text.
 */
export function shuffleQuizOptions<Q extends McQuestion>(questions: Q[], rand: () => number = Math.random): Q[] {
  const pool: number[] = [];
  questions.forEach((q, i) => pool.push(i % Math.max(1, q.options.length)));
  shuffleInPlace(pool, rand);
  return questions.map((q, i) => {
    const n = q.options.length;
    if (n < 2 || q.correct < 0 || q.correct >= n) return q;
    const target = (pool[i] ?? 0) % n;
    const others = shuffleInPlace(q.options.filter((_, k) => k !== q.correct), rand);
    const options = [...others];
    options.splice(target, 0, q.options[q.correct] as string);
    return { ...q, options, correct: target };
  });
}
