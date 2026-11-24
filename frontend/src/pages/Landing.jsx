import { Link } from "react-router-dom";
import { ArrowRight, HelpCircle, BookOpen, FileText, Layers, Brain, BarChart3, UploadCloud, MessagesSquare, ClipboardCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BLOOM } from "@/lib/utils";
import Statue from "@/components/Statue";

const features = [
  { icon: FileText, title: "Your own materials", text: "Upload PDFs, notes, slides and scans. Learn with Socrates teaches from what you actually study." },
  { icon: Brain, title: "Two teaching modes", text: "Switch between guided questioning and direct explanations at any moment." },
  { icon: Layers, title: "Bloom's Taxonomy", text: "Grow from remembering facts to creating original solutions." },
  { icon: BarChart3, title: "Honest progress", text: "Mastery comes from quiz evidence, not from pages you merely viewed." },
];

const steps = [
  { icon: UploadCloud, title: "Upload", text: "Add your PDFs, Word files, slides, notes or scans." },
  { icon: MessagesSquare, title: "Learn", text: "Explore topics with cited answers from your own pages." },
  { icon: ClipboardCheck, title: "Practice", text: "Take adaptive quizzes at every Bloom level." },
  { icon: Target, title: "Improve", text: "See weak concepts and get timely revision reminders." },
];

export default function Landing() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
        <div>
          <h1 className="text-4xl font-extrabold md:text-6xl">Learn Smarter.<br />Think Deeper.</h1>
          <p className="mt-5 max-w-lg text-lg text-grey">
            Upload your study materials, explore concepts through intelligent questioning, and build deeper understanding with personalized AI teaching.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register"><Button size="lg">Start Learning <ArrowRight size={18} /></Button></Link>
            <a href="#how"><Button size="lg" variant="outline">See How It Works</Button></a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div className="absolute inset-x-6 bottom-0 top-10 rounded-[2.5rem] bg-gradient-to-br from-sage/40 via-gold/20 to-transparent" />
          <Statue className="relative mx-auto w-full max-w-[460px] drop-shadow-[0_24px_30px_rgba(36,59,53,0.28)]" />
          <Card className="absolute -bottom-4 left-0 w-60 space-y-2 p-4 sm:w-64">
            <h3 className="font-display text-sm font-bold">Choose Your Mode</h3>
            <div className="flex items-center gap-3 rounded-xl border-2 border-brand bg-brand/5 p-2.5">
              <HelpCircle size={18} className="text-brand" />
              <div><p className="text-sm font-semibold text-forest">Socratic Learning</p><p className="text-xs text-grey">Discover through questions</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line p-2.5">
              <BookOpen size={18} className="text-gold" />
              <div><p className="text-sm font-semibold text-forest">Direct Teaching</p><p className="text-xs text-grey">Get clear explanations</p></div>
            </div>
          </Card>
        </div>
      </section>

      <section id="features" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="text-center text-3xl font-bold">Built for real understanding</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="p-5">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={20} /></span>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm text-grey">{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <h2 className="text-center text-3xl font-bold">How Learn with Socrates works</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest text-white"><Icon size={22} /></span>
              <p className="text-xs font-bold text-brand">STEP {i + 1}</p>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-grey">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modes" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="text-center text-3xl font-bold">Two ways to learn. One continuous journey.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-brand">Socratic Mode</h3>
              <p className="mt-2 text-grey">Guiding questions, progressive hints and follow-ups help you reach answers yourself and expose misconceptions.</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-bold text-brand">Direct Teaching Mode</h3>
              <p className="mt-2 text-grey">Clear explanations, examples, tables and summaries when you need the answer fast. Switch any time without losing context.</p>
            </Card>
          </div>
        </div>
      </section>

      <section id="bloom" className="relative overflow-hidden bg-forest py-16 text-white">
        <Statue flip className="absolute -bottom-6 -right-10 hidden w-80 opacity-15 lg:block" />
        <div className="relative mx-auto max-w-6xl px-4 text-center md:px-8">
          <h2 className="text-3xl font-bold text-white">Six levels of thinking</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">Every topic is assessed from Remember to Create, so you build skill, not just memory.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {BLOOM.map((b, i) => (
              <span key={b} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">
                <span className="mr-2 text-gold">{i + 1}</span>{b}
              </span>
            ))}
          </div>
          <Link to="/register"><Button variant="gold" size="lg" className="mt-10">Create your free account</Button></Link>
        </div>
      </section>
    </>
  );
}
