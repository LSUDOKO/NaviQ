import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { CIIRating, Port, Route, Waypoint } from "../../types";
import { CII_COLORS, MAP_TILES, SEA_STATE_COLORS } from "../../utils/constants";
import { int, num } from "../../utils/formatters";

export interface MapVessel {
  id: string;
  name: string;
  rating: CIIRating;
  ship_type: string;
  dwt: number;
  current_fuel: string;
  position: { lat: number; lon: number; route_name: string; near: string } | null;
}

interface FleetMapProps {
  routes: Route[];
  ports: Port[];
  vessels?: MapVessel[];
  height?: string;
  /** Colour each route leg by sea state rather than a single flat line. */
  colorByWeather?: boolean;
  highlightRouteId?: string | null;
  /** Per-leg speeds, drawn as a colour ramp along the track. */
  speedProfile?: { routeId: string; speeds: number[]; min: number; max: number } | null;
}

function speedColor(speed: number, min: number, max: number): string {
  // Slow is teal (efficient), fast is amber (expensive). The ramp makes an
  // optimised speed profile legible at a glance along the track.
  const t = Math.max(0, Math.min(1, (speed - min) / Math.max(max - min, 1e-6)));
  const from = [0, 191, 166];
  const to = [245, 158, 11];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
  return `rgb(${mix.join(",")})`;
}

export function FleetMap({
  routes,
  ports,
  vessels = [],
  height = "420px",
  colorByWeather = false,
  highlightRouteId = null,
  speedProfile = null,
}: FleetMapProps) {
  const positions = (waypoints: Waypoint[]): [number, number][] =>
    waypoints.map((w) => [w.lat, w.lon]);

  return (
    <MapContainer
      center={[12, 92]}
      zoom={4}
      style={{ height, width: "100%" }}
      scrollWheelZoom
      worldCopyJump
    >
      <TileLayer url={MAP_TILES.url} attribution={MAP_TILES.attribution} />

      {routes.map((route) => {
        const dimmed = highlightRouteId !== null && highlightRouteId !== route.id;
        const showSpeed = speedProfile?.routeId === route.id;

        // Per-leg rendering when there is leg-level data worth showing.
        if ((colorByWeather && route.weather?.length) || showSpeed) {
          return route.waypoints.slice(0, -1).map((waypoint, index) => {
            const next = route.waypoints[index + 1];
            const leg = route.weather?.[index];
            const color = showSpeed
              ? speedColor(
                  speedProfile.speeds[index] ?? speedProfile.speeds[0],
                  speedProfile.min,
                  speedProfile.max,
                )
              : SEA_STATE_COLORS[leg?.sea_state ?? "Slight"] ?? "#38BDF8";

            return (
              <Polyline
                key={`${route.id}-${index}`}
                positions={[
                  [waypoint.lat, waypoint.lon],
                  [next.lat, next.lon],
                ]}
                pathOptions={{ color, weight: dimmed ? 1.5 : 3.5, opacity: dimmed ? 0.25 : 0.9 }}
              >
                <Tooltip sticky>
                  <span className="text-xs">
                    <strong>{waypoint.name}</strong> to <strong>{next.name}</strong>
                    {showSpeed && (
                      <>
                        <br />
                        Speed {num(speedProfile.speeds[index] ?? 0, 1)} kn
                      </>
                    )}
                    {leg && (
                      <>
                        <br />
                        {leg.sea_state} sea, {num(leg.wave_height_m, 1)} m
                        <br />
                        Wind {num(leg.wind_speed_kn, 0)} kn
                      </>
                    )}
                  </span>
                </Tooltip>
              </Polyline>
            );
          });
        }

        return (
          <Polyline
            key={route.id}
            positions={positions(route.waypoints)}
            pathOptions={{
              color: dimmed ? "#1E3A5F" : "#00BFA6",
              weight: dimmed ? 1.5 : 2.5,
              opacity: dimmed ? 0.35 : 0.75,
              dashArray: dimmed ? "4 6" : undefined,
            }}
          >
            <Tooltip sticky>
              <span className="text-xs">
                <strong>{route.name}</strong>
                <br />
                {int(route.distance_nm)} nm
              </span>
            </Tooltip>
          </Polyline>
        );
      })}

      {ports.map((port) => {
        const shoreColor =
          port.shore_power === "available"
            ? "#22C55E"
            : port.shore_power === "planned"
              ? "#F59E0B"
              : "#64748B";
        return (
          <CircleMarker
            key={port.id}
            center={[port.lat, port.lon]}
            radius={5}
            pathOptions={{ color: shoreColor, fillColor: shoreColor, fillOpacity: 0.5, weight: 1.5 }}
          >
            <Popup>
              <strong>{port.name}</strong>
              <br />
              {port.country}
              <br />
              Shore power: {port.shore_power}
              {port.shore_power !== "unavailable" && ` (${int(port.shore_power_kw)} kW)`}
              <br />
              Grid {int(port.grid_ci_gco2_per_kwh)} gCO₂/kWh
            </Popup>
          </CircleMarker>
        );
      })}

      {vessels
        .filter((vessel) => vessel.position)
        .map((vessel) => (
          <CircleMarker
            key={vessel.id}
            center={[vessel.position!.lat, vessel.position!.lon]}
            radius={7}
            pathOptions={{
              color: CII_COLORS[vessel.rating],
              fillColor: CII_COLORS[vessel.rating],
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{vessel.name}</strong>
              <br />
              CII rating {vessel.rating} · {int(vessel.dwt)} DWT
              <br />
              Burning {vessel.current_fuel}
              <br />
              On {vessel.position!.route_name}
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}

export default FleetMap;
