import { ChevronDown } from "lucide-react";
import styles from "./storytelling.module.css";

export function ScrollCue({ ariaLabel }: { ariaLabel: string }) {
  return (
    <span className={styles.scrollCue} role="img" aria-label={ariaLabel}>
      <ChevronDown aria-hidden="true" />
    </span>
  );
}
