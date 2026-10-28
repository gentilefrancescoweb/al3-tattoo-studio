# AI redraws of Sgt. Zippo's tattoos (round 6)

Masters for the floating stickers: `site/scripts/lift-redraws.py` turns each `<id>.webp` here into
`site/public/ink/<id>.webp` and `ink/h/<id>.webp`. Ids: `aNNN` = feed photo NNN, `wNN` = "Mix" reel frame NN.

- Made 2026-10-18 with Higgsfield, model **Nano Banana 2.1** (`nano_banana_2_1`), resolution 2k, aspect ratio auto,
  thinking level high, 2 credits per image; saved here at 2048 px, WebP q92.
- Reference: the original Instagram photo (or reel frame) of that tattoo, nothing else.
- Prompt, identical for every design:

  > Redraw the tattoo in this photo as clean tattoo flash artwork. Reproduce the exact same design 1:1: identical
  > linework, line weights, shapes, proportions, composition, details, lettering and black-and-grey shading; keep
  > any coloured ink exactly as it is. Remove completely the skin, the arm or body, hair, shadows, reflections and
  > the background: only the design, centred, on a pure flat white background, seen straight on (flatten the curve
  > of the limb). Do not add, remove, restyle or reinterpret anything. No new elements, no frame, no signature, no
  > text that is not in the tattoo, no watermark. Crisp, high-resolution, print-quality ink.

- Exception: `a384` (Venom, neck piece) was blocked by the image filter from the photo; it was redrawn from the
  skin-free photo cut-out instead, with the prompt adapted ("solid black-ink blackwork design; the pale areas are
  bare negative space").
- Not redrawn (filter refused even the cut-outs): a423 Stitch, a426 angel/devil, a511 Piglet. They are photo-only.
- Every result was compared by eye with its photo before use. The footer of the site discloses the redraws.
