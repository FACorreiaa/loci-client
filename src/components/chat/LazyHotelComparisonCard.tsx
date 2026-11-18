import { lazy, Suspense, type Component } from "solid-js";
import type { HotelComparisonCardProps } from "./HotelComparisonCard";

const Card = lazy(() => import("./HotelComparisonCard"));

/**
 * The comparison card, loaded only when a report arrives: most chats never
 * draw one, so /chat and /itinerary do not pay for it up front. Its own
 * Suspense keeps the load from suspending the route around it.
 */
const LazyHotelComparisonCard: Component<HotelComparisonCardProps> = (props) => (
  <Suspense>
    <Card {...props} />
  </Suspense>
);

export default LazyHotelComparisonCard;
