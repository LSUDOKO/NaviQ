/**
 * Approximate the A-E boundaries from a required CII value.
 *
 * The exact dd multipliers vary by ship type and live on the server, which
 * returns them with any detailed CII result. The fleet summary is deliberately
 * lighter and omits them, so this uses the mid-range multipliers common to the
 * dry and wet cargo types. It is only ever used to position a compact rail
 * where the exact band edges are not the point; every detailed view uses the
 * server's own boundaries.
 */
export function ratingBoundaries(required: number): Record<string, number> {
  return {
    A_upper: required * 0.84,
    B_upper: required * 0.94,
    C_upper: required * 1.06,
    D_upper: required * 1.19,
  };
}
