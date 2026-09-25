import type { Metadata } from "next";
import { z } from "zod";
import { IconTelephone } from "@/components/icons";
import { Badge, Button, Callout, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/server/market/format";
import { getTranslator } from "@/server/content/ui/i18n";
import { listSmsOutbox } from "@/server/content/sms-outbox";
import { listDemoFarmers } from "@/server/content/ussd-provider";
import { USSD_CODE } from "@/server/content/ussd";
import { UssdSimulator } from "./UssdSimulator";

export const metadata: Metadata = { title: "Simulateur SMS / USSD (démo)" };

/** Filtre par numéro (fin de numéro acceptée) ; toute autre saisie est ignorée. */
const phoneFilter = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{2,15}$/)
  .optional()
  .catch(undefined);

/** Simulateur SMS / USSD (AGENT/ADMIN) — DÉMO : aucun SMS réel n'est envoyé. */
export default async function AgentSmsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("AGENT");
  const sp = await searchParams;
  const tel = phoneFilter.parse(typeof sp.tel === "string" && sp.tel !== "" ? sp.tel : undefined);
  const { locale, tr } = await getTranslator();
  const dl = locale === "yo" ? "yo-NG" : "fr-FR";
  const [messages, farmers] = await Promise.all([listSmsOutbox({ phone: tel, take: 50 }), listDemoFarmers()]);
  const invalidFilter = typeof sp.tel === "string" && sp.tel.trim() !== "" && !tel;

  return (
    <>
      <PageHeader title={tr("agent.sms_simulator")} icon={<IconTelephone size={36} />} />
      <Callout tone="warning" title={tr("agt.sms.demo_banner")} className="mb-6">
        {tr("agt.sms.demo_detail")}
      </Callout>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="fil-sms" className="flex flex-col gap-4">
          <h2 id="fil-sms" className="text-xl">
            {tr("agt.sms.outbox_title")}
          </h2>
          <form method="get" className="flex flex-wrap items-end gap-3" role="search">
            <Field
              id="tel"
              label={tr("agt.sms.filter_label")}
              hint={tr("agt.sms.filter_hint")}
              error={invalidFilter ? tr("agt.sms.filter_invalid") : undefined}
              className="grow"
            >
              {(p) => <Input {...p} name="tel" type="tel" inputMode="tel" autoComplete="off" defaultValue={typeof sp.tel === "string" ? sp.tel : ""} />}
            </Field>
            <Button type="submit" variant="secondary">
              {tr("agt.sms.filter_submit")}
            </Button>
            {tel ? (
              <Button href="/agent/sms" variant="ghost">
                {tr("agt.sms.filter_clear")}
              </Button>
            ) : null}
          </form>

          <div className="mx-auto w-full max-w-[380px] rounded-[2rem] border-4 border-ink bg-ink p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold text-canvas">
              <span>{tr("agt.sms.phone_title")}</span>
              <span>{tr("common.demo")}</span>
            </div>
            <div className="max-h-[560px] overflow-y-auto rounded-xl bg-canvas p-3">
              {messages.length === 0 ? (
                <EmptyState
                  kind={tel ? "no-results" : "first-use"}
                  icon={<IconTelephone size={44} />}
                  title={tel ? tr("agt.sms.empty_filtered") : tr("agt.sms.empty")}
                  message={tel ? undefined : tr("agt.sms.empty_hint")}
                />
              ) : (
                <ol className="flex flex-col gap-3" aria-label={tr("agt.sms.outbox_title")}>
                  {messages.map((m) => (
                    <li key={m.id} className="rounded-2xl rounded-tl-sm border border-line bg-surface p-3 shadow-card">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <span className="font-semibold text-ink tabular-nums">{m.toPhone}</span>
                        <Badge tone="neutral">{m.lang.toUpperCase()}</Badge>
                        <time dateTime={m.createdAt.toISOString()}>{formatDateTime(m.createdAt, dl)}</time>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-ink">{m.body}</p>
                      {m.alertTitle ? <p className="mt-1 text-xs text-ink-muted">{tr("agt.sms.linked_alert", { title: m.alertTitle })}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="ussd" className="flex flex-col gap-4">
          <h2 id="ussd" className="text-xl">
            {tr("agt.ussd.title", { code: USSD_CODE })}
          </h2>
          <p className="text-sm text-ink-muted">{tr("agt.ussd.intro")}</p>
          {farmers.length === 0 ? (
            <EmptyState kind="first-use" icon={<IconTelephone size={44} />} title={tr("agt.ussd.no_farmer")} />
          ) : (
            <UssdSimulator
              code={USSD_CODE}
              farmers={farmers.map((f) => ({ id: f.id, label: `${f.fullName} · ${f.phone}` }))}
              labels={{
                farmer: tr("agt.ussd.farmer"),
                dial: tr("agt.ussd.dial", { code: USSD_CODE }),
                hangUp: tr("agt.ussd.hang_up"),
                input: tr("agt.ussd.input"),
                inputHint: tr("agt.ussd.input_hint"),
                send: tr("agt.ussd.send"),
                idle: tr("agt.ussd.idle", { code: USSD_CODE }),
                ended: tr("agt.ussd.ended"),
                invalid: tr("agt.ussd.invalid"),
                notFound: tr("agt.ussd.not_found"),
                failed: tr("agt.ussd.failed"),
                screen: tr("agt.ussd.screen"),
              }}
            />
          )}
        </section>
      </div>
    </>
  );
}
