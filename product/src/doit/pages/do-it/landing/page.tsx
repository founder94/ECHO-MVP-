import { useNavigate } from "react-router-dom";
import { LandingHero } from "@/doit/app/plan-a/screens/LandingHero";

export default function Landing() {
  const navigate = useNavigate();
  const goStart = () => navigate("/doit/choose");

  return <LandingHero onEnter={goStart} onHeroStart={goStart} />;
}