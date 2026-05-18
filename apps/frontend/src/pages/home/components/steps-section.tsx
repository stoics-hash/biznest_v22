import { MapPin, Sparkles, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    step: "Step 01",
    title: "Tell BizNest What You Are Building",
    description:
      "Share your business type, budget range, and ideal customer profile in under 2 minutes.",
    hint: "No spreadsheets, no manual research needed.",
    icon: MapPin,
    color: "text-blue-500",
    badgeColor: "bg-blue-500/15 border-blue-500/40",
  },
  {
    step: "Step 02",
    title: "Review AI-Ranked Location Matches",
    description:
      "Get a clear shortlist of high-potential areas scored by demand, competition, and growth signals.",
    hint: "Focus on the top opportunities first.",
    icon: Sparkles,
    color: "text-amber-500",
    badgeColor: "bg-amber-500/15 border-amber-500/40",
  },
  {
    step: "Step 03",
    title: "Launch Faster With Local Connections",
    description:
      "Connect with nearby businesses and partners to accelerate your opening and reduce launch friction.",
    hint: "Move from idea to opening with confidence.",
    icon: Handshake,
    color: "text-green-500",
    badgeColor: "bg-green-500/15 border-green-500/40",
  },
];

export function StepsSection() {
  return (
    <section className="w-full bg-background py-14 md:py-20">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
        {/* Heading */}
        <div className="mx-auto mb-14 max-w-4xl text-center md:mb-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Your Roadmap
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Go from business idea to the right location in 3 smart steps
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            BizNest helps you decide, validate, and connect, so your next move
            is guided by data instead of guesswork.
          </p>
        </div>

        {/* Step Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:p-8"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${item.badgeColor}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${item.color} transition-transform duration-300 group-hover:scale-110`}
                    />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {item.step}
                  </span>
                </div>

                <h3 className="mb-3 text-xl font-semibold leading-tight md:text-2xl">
                  {item.title}
                </h3>

                <p className="mb-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.description}
                </p>
                <p className="text-sm text-primary/90">{item.hint}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
