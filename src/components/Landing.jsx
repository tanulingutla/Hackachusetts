import SportsSketch from "./SportsSketch.jsx";

// Home page shown before sign-in. Describes what the app does and how data is handled.
// Copy here must match what the app actually does.
const STEPS = [
  {
    number: "1",
    title: "Import your training data",
    text: "Upload a daily CSV export from your watch. Impossible readings are dropped, not averaged in.",
  },
  {
    number: "2",
    title: "Log meals by voice",
    text: "Say what you ate in plain words. You get a calorie range you can confirm or edit before saving.",
  },
  {
    number: "3",
    title: "Read the weekly check",
    text: "See whether fueling and recovery are moving the wrong way across the week, then download a PDF report if needed.",
  },
];

export default function Landing({ onChoose }) {
  return (
    <>
      <header className="home-top">
        <p className="brand">why tho</p>
        <nav className="home-nav" aria-label="Account">
          <button type="button" className="home-nav-button outline" onClick={() => onChoose("signup")}>
            Create account
          </button>
          <button type="button" className="home-nav-button filled" onClick={() => onChoose("signin")}>
            Sign in
          </button>
        </nav>
      </header>

      <div className="sketch-band">
        <SportsSketch />
      </div>

      <main className="home">
        <h1 className="home-title">Is it overtraining, or are you underfueling?</h1>

        <p className="home-lead">
          WHY THO combines your <strong>watch data</strong>, your <strong>voice-logged meals</strong>, and optional{" "}
          <strong>cycle tracking</strong> to show which one is happening. It looks at weekly trends, not single days,
          and builds a PDF report for your coach, sports dietitian, or doctor.
        </p>

        <ul className="home-list">
          <li>Import daily watch data from a CSV export</li>
          <li>Log meals by saying what you ate, and get a calorie range</li>
          <li>See your daily target, what you have eaten, and what is still remaining</li>
          <li>Optional period tracking for athletes who menstruate</li>
          <li>Add fat-free mass or measured RMR for a sharper target</li>
          <li>Download a PDF report to hand to a coach, dietitian, or doctor</li>
        </ul>


        <section className="how-it-works" aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step.number} className="step">
                <span className="step-number" aria-hidden="true">
                  {step.number}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <p className="privacy-note">
          Your account and its data are stored on the WHY THO server and are visible only to you. Meal text is
          processed by the calorie parser, which may use an AI model. Nothing is shared with anyone unless you download
          a report and send it.
        </p>
      </main>
    </>
  );
}
