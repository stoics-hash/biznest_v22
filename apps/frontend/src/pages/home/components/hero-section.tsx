import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { H1, Small, Lead } from "@/components/ui/typography";

const benefits = [
  "AI-driven location insights tailored to your industry",
  "Connect with nearby businesses instantly",
  "Free to join — get started in minutes",
];

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden py-12 md:py-20">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
        <div className="mx-auto max-w-3xl">
          {/* Badge */}
          <Small className="mb-4 inline-block rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-primary">
            For Growth-Minded Founders
          </Small>

          {/* Heading */}
          <H1 className="mb-3">
            Smart <span className="text-primary">Locations.</span> Stronger{" "}
            <span className="text-primary">Connections.</span> Powered by AI.
          </H1>

          {/* Subheading */}
          <Lead className="mb-6 max-w-xl">
            An AI-powered system that helps choose business locations and
            connects local businesses in your city.
          </Lead>

          {/* CTA Buttons */}
          <div className="mb-8 flex gap-3">
            <Button asChild>
              <Link to="/register">Join BizNest Now</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/about">See How AI Helps</Link>
            </Button>
          </div>

          {/* Benefits */}
          <ul className="space-y-2">
            {benefits.map((benefit, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-base text-foreground/90 md:text-lg"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
