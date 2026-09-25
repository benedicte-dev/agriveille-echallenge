import { WeatherDay, weatherCondition, type Severity } from "@/components/ui";
import type { DailyForecast } from "@/lib/monitoring";
import type { PageI18n } from "@/server/monitoring/present";

/** Libellés de condition météo traduits (WeatherDay). */
export function conditionLabels(i: PageI18n) {
  return {
    sun: i.tr("weather.sunny"),
    cloud: i.tr("weather.cloudy"),
    rain: i.tr("weather.rain"),
    storm: i.tr("weather.storm"),
    wind: i.tr("weather.wind"),
    alert: i.tr("alert.new"),
  };
}

/** Une journée de prévision → WeatherDay (jour courant bordé, alerte éventuelle). */
export function ForecastDay({
  day,
  i,
  todayIso,
  alert,
}: {
  day: DailyForecast;
  i: PageI18n;
  todayIso: string;
  alert?: Severity;
}) {
  const noon = new Date(`${day.date}T12:00:00Z`);
  const today = day.date === todayIso;
  return (
    <WeatherDay
      dayLabel={today ? i.tr("common.today") : i.fmtDate(noon, { weekday: "short", day: "numeric" })}
      dateLabel={i.fmtIsoDay(day.date)}
      condition={weatherCondition({ rainMm: day.precipMm, windKmh: day.windMaxKmh, humidity: day.humidityMean })}
      tMax={day.tmax}
      tMin={day.tmin}
      rainMm={day.precipMm}
      windKmh={day.windMaxKmh}
      today={today}
      alert={alert}
      labels={conditionLabels(i)}
    />
  );
}
