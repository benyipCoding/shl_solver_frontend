import { ff14Styles } from "@/constants/ff14";
import type { StaticText } from "@/interfaces/ff14";

interface EmptyStateProps {
  text: StaticText;
}

const EmptyState = ({ text }: EmptyStateProps) => {
  return (
    <section className={ff14Styles.emptyState}>
      <h2>{text.emptyTitle}</h2>
      <p>{text.emptyDesc}</p>
    </section>
  );
};

export default EmptyState;
