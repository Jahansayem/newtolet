// Shared sizing for the home cover carousel and its placeholders so they never
// disagree (a mismatch causes a layout jump when the carousel mounts).
//
// Admins upload 3:1 banners (1920x640, see coverPhotoService.js) and the slide
// image is object-fit: cover, so the frame must keep that same ratio at every
// width or the sides get cropped on phones and tablets. The home page is full
// width, so the height is capped at 480px: past ~1440px of content width the
// frame gets wider than 3:1 and the banner crops slightly top and bottom
// instead of pushing the listings below the fold.
export const COVER_FRAME_CLASSES = 'w-full aspect-[3/1] max-h-[480px]';
