"use client";

/**
 * Whether the screen a block belongs to has actually been reached.
 *
 * Every entrance on this page is a screen's own: the heading does not assemble
 * while the reader is still four screens above it, and the relay panel does
 * not lay its path before anyone can see it. `ScreenFade` knows when its
 * window opens — this carries that one fact down to whatever is inside it, so
 * a block can start its own motion at the right moment without knowing
 * anything about the stage.
 *
 * It latches **on the way in**: a screen reached once has arrived, and nothing
 * about scrolling back up there makes it assemble a second time.
 *
 * A screen leaving is a different thing. Where its `ScreenFade` is told to
 * leave in reverse, this goes back to false as the leave window opens, and the
 * blocks inside play their own arrival backwards — which is what the flight
 * looks like from the other direction, and is the one case where a block
 * performing again is exactly right.
 */

import { createContext, useContext } from "react";

const Arrival = createContext(true);

export const ArrivalProvider = Arrival.Provider;

/** True once the surrounding screen has been reached. */
export const useArrived = (): boolean => useContext(Arrival);
