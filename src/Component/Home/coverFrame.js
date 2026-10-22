// Shared sizing for the home cover carousel and its placeholders so they never
// disagree (a mismatch here causes layout jumps when the carousel mounts).
// Height scales with width instead of fixed pixel steps; the ladder is ~2:1 on
// phones and reaches the 3:1 ratio admins are asked to upload on wide screens.
export const COVER_FRAME_CLASSES =
    'w-full aspect-[2/1] max-h-[420px] md:aspect-[5/2] xl:aspect-[3/1]';
