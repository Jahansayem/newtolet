// Shared sizing for the home cover carousel and its placeholders so they never
// disagree (a mismatch causes a layout jump when the carousel mounts).
//
// Admins upload 3:1 banners (1920x640, see coverPhotoService.js) and the slide
// image is object-fit: cover, so the frame must keep that same ratio at every
// width or the sides get cropped on phones and tablets. Width is fluid inside
// .site-shell (at most ~1216px), so the frame is never taller than ~405px.
export const COVER_FRAME_CLASSES = 'w-full aspect-[3/1]';
