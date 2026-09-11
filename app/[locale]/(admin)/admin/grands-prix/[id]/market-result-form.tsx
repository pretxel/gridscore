import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/admin/submit-button";
import { NativeSelect } from "@/components/ui/native-select";
import { NO_RETIREMENT, RESULT_CONTROL, resultToFormValues } from "@/lib/admin/market-result";
import type { MarketRow } from "@/lib/db";
import { type DriverOption, driverLabel } from "@/lib/driver-format";
import type { Locale } from "@/lib/i18n";
import type { MarketPick } from "@/lib/markets";
import { acceptSuggestion, reopenMarket, saveMarketResult, voidMarket } from "./actions";

// One row of the weekend's result editor: the controls a market's type needs,
// the provider's suggestion when there is one, and the void / reopen escapes.
// Server component — the controls are plain form fields, so no client
// JavaScript is required to enter a result.
export async function MarketResultForm({
  market,
  drivers,
  locale,
  grandPrixId,
}: {
  market: MarketRow;
  drivers: DriverOption[];
  locale: Locale;
  grandPrixId: string;
}) {
  const t = await getTranslations("admin");
  const tm = await getTranslations("markets");
  const control = RESULT_CONTROL[market.type];
  const current = resultToFormValues(
    market.type,
    (market.result ?? market.suggested_result) as MarketPick | null,
  );
  const isVoid = market.status === "void";
  const hasSuggestion = market.suggested_result != null && market.result == null;

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading text-base font-semibold">{tm(`type.${market.type}`)}</h3>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {tm(`status.${market.status}`)} ·{" "}
            {market.resolution_source ? t(`markets.source.${market.resolution_source}`) : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasSuggestion ? (
            <form action={acceptSuggestion}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="grand_prix_id" value={grandPrixId} />
              <input type="hidden" name="market_id" value={market.id} />
              <SubmitButton variant="outline" size="sm">
                {t("markets.acceptSuggestion")}
              </SubmitButton>
            </form>
          ) : null}
          <form action={isVoid || market.status === "resolved" ? reopenMarket : voidMarket}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="grand_prix_id" value={grandPrixId} />
            <input type="hidden" name="market_id" value={market.id} />
            <SubmitButton variant="ghost" size="sm">
              {isVoid || market.status === "resolved" ? t("markets.reopen") : t("markets.void")}
            </SubmitButton>
          </form>
        </div>
      </div>

      {isVoid ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("markets.voidedBody")}</p>
      ) : (
        <form
          action={saveMarketResult}
          className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-end"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <input type="hidden" name="market_id" value={market.id} />
          <input type="hidden" name="market_type" value={market.type} />

          {control === "yes-no" ? (
            <Field id={`value-${market.id}`} label={t("markets.outcome")}>
              <NativeSelect
                id={`value-${market.id}`}
                name="value"
                defaultValue={current.value ?? ""}
                className="h-10 w-full sm:h-8 sm:w-auto"
              >
                <option value="">{t("markets.choose")}</option>
                <option value="yes">{tm("yes")}</option>
                <option value="no">{tm("no")}</option>
              </NativeSelect>
            </Field>
          ) : null}

          {control === "driver" || control === "driver-or-none" ? (
            <Field id={`driver-${market.id}`} label={t("markets.driver")}>
              <DriverSelect
                id={`driver-${market.id}`}
                name="driver_id"
                drivers={drivers}
                defaultValue={current.driver_id ?? ""}
                placeholder={t("markets.choose")}
                noneLabel={control === "driver-or-none" ? tm("none") : undefined}
              />
            </Field>
          ) : null}

          {control === "podium"
            ? (["p1", "p2", "p3"] as const).map((slot) => (
                <Field key={slot} id={`${slot}-${market.id}`} label={t(`markets.${slot}` as never)}>
                  <DriverSelect
                    id={`${slot}-${market.id}`}
                    name={slot}
                    drivers={drivers}
                    defaultValue={current[slot] ?? ""}
                    placeholder={t("markets.choose")}
                  />
                </Field>
              ))
            : null}

          <SubmitButton size="sm" className="h-10 sm:h-7">
            {t("markets.saveResult")}
          </SubmitButton>
          {hasSuggestion ? (
            <span className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
              {t("markets.prefilledFromSuggestion")}
            </span>
          ) : null}
        </form>
      )}
    </li>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// Inactive drivers stay listed when they are the current answer, so a historic
// result never loses its driver.
function DriverSelect({
  id,
  name,
  drivers,
  defaultValue,
  placeholder,
  noneLabel,
}: {
  id: string;
  name: string;
  drivers: DriverOption[];
  defaultValue: string;
  placeholder: string;
  noneLabel?: string;
}) {
  const options = drivers.filter((d) => d.active || d.id === defaultValue);
  return (
    <NativeSelect
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="h-10 w-full sm:h-8 sm:w-auto"
    >
      <option value="">{placeholder}</option>
      {noneLabel ? <option value={NO_RETIREMENT}>{noneLabel}</option> : null}
      {options.map((driver) => (
        <option key={driver.id} value={driver.id}>
          {driverLabel(driver)}
        </option>
      ))}
    </NativeSelect>
  );
}
