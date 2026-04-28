import { ff14Styles } from "@/constants/ff14";
import type { StaticText } from "@/interfaces/ff14";

interface HeroSectionProps {
  text: StaticText;
}

const HeroSection = ({ text }: HeroSectionProps) => {
  return (
    <section className={ff14Styles.hero}>
      <p className={ff14Styles.kicker}>{text.kicker}</p>
      <h1>{text.heroTitle}</h1>
      <p>{text.heroDesc}</p>
    </section>
  );
};

export default HeroSection;
