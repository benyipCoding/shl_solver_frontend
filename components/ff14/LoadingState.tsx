import { Activity, LoaderCircle } from "lucide-react";

import { ff14Styles } from "@/constants/ff14";
import styles from "./LoadingState.module.css";

export const LoadingBadge = ({ label }: { label: string }) => (
  <span className={styles.badge}>
    <LoaderCircle size={14} className={styles.spinner} aria-hidden />
    {label}
  </span>
);

export const LoadingNotice = ({ title }: { title: string }) => (
  <div className={styles.notice} role="status">
    <span className={styles.noticeIcon} aria-hidden>
      <LoaderCircle size={19} className={styles.spinner} />
    </span>
    <span>{title}</span>
    <span className={styles.dots} aria-hidden><i /><i /><i /></span>
  </div>
);

interface LoadingStateProps {
  title: string;
  description: string;
  label: string;
  variant?: "summary" | "timeline";
}

const LoadingState = ({
  title,
  description,
  label,
  variant = "summary",
}: LoadingStateProps) => (
  <section className={`${ff14Styles.card} ${styles.card}`} aria-label={title}>
    <div className={styles.header} role="status" aria-atomic="true">
      <div className={styles.signal} aria-hidden>
        <span className={styles.orbit} />
        <span className={styles.innerOrbit} />
        <Activity size={25} strokeWidth={1.5} />
      </div>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>
          <span className={styles.statusDot} aria-hidden />
          {label}
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>

    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonHeading}>
        <span className={styles.line} />
        <span className={styles.line} />
      </div>
      {variant === "summary" ? (
        <div className={styles.rows}>
          {[88, 73, 62, 48, 36].map((width, index) => (
            <div key={width} className={styles.row}>
              <span className={styles.avatar} />
              <div className={styles.identity}>
                <span className={styles.line} style={{ width: `${76 - index * 7}%` }} />
                <span className={styles.subline} />
              </div>
              <span className={styles.barTrack}>
                <span className={styles.bar} style={{ width: `${width}%` }} />
              </span>
              <span className={`${styles.line} ${styles.value}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.lanes}>
          {[0, 1, 2].map((row) => (
            <div className={styles.lane} key={row}>
              <div className={styles.trackIdentity}>
                <span className={styles.avatar} />
                <span className={styles.line} />
              </div>
              <div className={styles.track}>
                {[6, 16, 32, 43, 52, 70, 84].map((position, index) => (
                  <span
                    key={position}
                    className={styles.event}
                    style={{ left: `${position + row * 2}%`, top: index % 2 ? "28px" : "13px" }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);

export default LoadingState;
