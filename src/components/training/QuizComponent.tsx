import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuizQuestion { q: string; a: string[]; correct: number; }

interface Props {
  questions: QuizQuestion[];
  onPass: (score: number) => void;
}

export function QuizComponent({ questions, onPass }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const correctCount = answers.reduce<number>(
    (acc, a, i) => (a === questions[i].correct ? acc + 1 : acc), 0
  );
  const allAnswered = answers.every((a) => a !== null);
  const passed = submitted && correctCount === questions.length;

  const submit = () => {
    setSubmitted(true);
    if (correctCount === questions.length) onPass(100);
  };

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <Card key={qi} className="p-4">
          <p className="font-medium mb-3">{qi + 1}. {q.q}</p>
          <div className="space-y-2">
            {q.a.map((opt, oi) => {
              const selected = answers[qi] === oi;
              const isCorrect = oi === q.correct;
              return (
                <button
                  key={oi}
                  disabled={submitted && passed}
                  onClick={() => {
                    if (submitted && passed) return;
                    const next = [...answers]; next[qi] = oi; setAnswers(next);
                    if (submitted) setSubmitted(false);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-md border transition-colors flex items-center gap-2",
                    selected && !submitted && "border-primary bg-primary/5",
                    submitted && selected && isCorrect && "border-green-500 bg-green-500/10",
                    submitted && selected && !isCorrect && "border-destructive bg-destructive/10",
                    submitted && !selected && isCorrect && "border-green-500/50",
                    !selected && !submitted && "hover:bg-muted"
                  )}
                >
                  {submitted && selected && (isCorrect
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      <div className="flex items-center justify-between pt-2">
        {submitted ? (
          passed ? (
            <p className="text-green-600 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> 100% — módulo liberado para conclusão!
            </p>
          ) : (
            <p className="text-destructive">{correctCount}/{questions.length} corretas. Revise e tente de novo.</p>
          )
        ) : <span className="text-sm text-muted-foreground">Acerte 100% para concluir.</span>}
        <Button disabled={!allAnswered || (submitted && passed)} onClick={submit}>
          {submitted && !passed ? "Tentar novamente" : "Verificar"}
        </Button>
      </div>
    </div>
  );
}
