import { Link2 } from "lucide-react";

import { ff14Styles } from "@/constants/ff14";
import type { Locale, ParsedReport, StaticText } from "@/interfaces/ff14";

interface ReportInputCardProps {
  text: StaticText;
  locale: Locale;
  hasValidReport: boolean;
  reportUrl: string;
  parsedReport: ParsedReport | null;
  onToggleLocale: () => void;
  onReportUrlChange: (value: string) => void;
}

const ReportInputCard = ({
  text,
  locale,
  hasValidReport,
  reportUrl,
  parsedReport,
  onToggleLocale,
  onReportUrlChange,
}: ReportInputCardProps) => {
  return (
    <section className={ff14Styles.card}>
      <div className={ff14Styles.cardHeader}>
        <h2>
          <Link2 size={18} />
          {text.reportInputTitle}
        </h2>
        <div className={ff14Styles.headerControls}>
          <button
            type="button"
            className={ff14Styles.languageSwitch}
            role="switch"
            aria-checked={locale === "en"}
            aria-label={text.switchAria}
            onClick={onToggleLocale}
          >
            <span
              className={`${ff14Styles.langOption} ${
                locale === "zh" ? ff14Styles.langOptionActive : ""
              }`}
            >
              {text.switchZh}
            </span>
            <span className={ff14Styles.langTrack}>
              <span
                className={`${ff14Styles.langThumb} ${
                  locale === "en" ? ff14Styles.langThumbRight : ""
                }`}
              />
            </span>
            <span
              className={`${ff14Styles.langOption} ${
                locale === "en" ? ff14Styles.langOptionActive : ""
              }`}
            >
              {text.switchEn}
            </span>
          </button>

          <span
            className={
              hasValidReport ? ff14Styles.statusReady : ff14Styles.statusIdle
            }
          >
            {hasValidReport ? text.statusReady : text.statusIdle}
          </span>
        </div>
      </div>

      <label className={ff14Styles.inputLabel} htmlFor="fflogs-report-url">
        {text.reportUrlLabel}
      </label>
      <input
        id="fflogs-report-url"
        className={ff14Styles.urlInput}
        placeholder={text.reportUrlPlaceholder}
        value={reportUrl}
        onChange={(event) => onReportUrlChange(event.target.value)}
      />

      <div className={ff14Styles.metaRow}>
        {parsedReport ? (
          <>
            <span className={ff14Styles.metaBadge}>
              {text.reportPrefix}: {parsedReport.reportId}
            </span>
            <span className={ff14Styles.metaBadge}>
              {text.fightPrefix}: #{parsedReport.fightId}
            </span>
            <span className={ff14Styles.metaHint}>{text.todoHint}</span>
          </>
        ) : (
          <span className={ff14Styles.metaHint}>
            {text.examplePrefix}
            https://www.fflogs.com/reports/yZrcbBYf8GL9TqCF?fight=112
          </span>
        )}
      </div>
    </section>
  );
};

export default ReportInputCard;
