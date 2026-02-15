# PDF Layout Issues - Ficha de Item

## Problems identified:
1. QR code section at the bottom is cut off - the QR and text below it are being clipped
2. The "FOTO DESPUÉS" shows a screenshot of the app UI (with buttons, nav bar) instead of just the photo
3. Content overflows the page - needs to fit on letter size (216x279mm / 8.5x11in)
4. The photos are too large, taking up too much vertical space
5. The plano image on the right is good size but could be slightly smaller

## Fixes needed:
- Reduce photo sizes to fit within page
- Ensure QR code section has enough space at bottom
- Use proper page dimensions for letter size
- Add page break logic if content exceeds one page
- Reduce margins/padding where possible
- Make fonts slightly smaller for info section
