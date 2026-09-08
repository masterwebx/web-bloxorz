/** Dark techno glyphs matching the original Passcode / Moves HUD. */
export const GLYPH: Record<string, string[]> = {
  "0": [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "  ## ", " #   ", "#    ", "#####"],
  "3": [" ### ", "#   #", "    #", "  ## ", "    #", "#   #", " ### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": [" ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", "  #  ", "  #  ", "  #  "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "    #", " ### "],
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  G: [" ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ### "],
  M: ["#   #", "## ##", "# # #", "#   #", "#   #", "#   #", "#   #"],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  a: ["     ", "     ", " ### ", "    #", " ####", "#   #", " ####"],
  c: ["     ", "     ", " ### ", "#    ", "#    ", "#    ", " ### "],
  d: ["    #", "    #", " ####", "#   #", "#   #", "#   #", " ####"],
  e: ["     ", "     ", " ### ", "#   #", "#####", "#    ", " ### "],
  m: ["     ", "     ", "## # ", "# # #", "# # #", "#   #", "#   #"],
  n: ["     ", "     ", "#### ", "#   #", "#   #", "#   #", "#   #"],
  o: ["     ", "     ", " ### ", "#   #", "#   #", "#   #", " ### "],
  s: ["     ", "     ", " ####", "#    ", " ### ", "    #", "#### "],
  u: ["     ", "     ", "#   #", "#   #", "#   #", "#   #", " ####"],
  v: ["     ", "     ", "#   #", "#   #", "#   #", " # # ", "  #  "],
  ":": ["     ", "  #  ", "  #  ", "     ", "  #  ", "  #  ", "     "],
  " ": ["  ", "  ", "  ", "  ", "  ", "  ", "  "],
  ".": ["     ", "     ", "     ", "     ", "     ", "  #  ", "  #  "],
};

export function glyphWidth(ch: string, scale: number): number {
  const g = GLYPH[ch] ?? GLYPH[" "];
  return (g[0].length + 1) * scale;
}

export function textWidth(text: string, scale: number): number {
  let w = 0;
  for (const ch of text) w += glyphWidth(ch, scale);
  return w;
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  align: "left" | "right" = "left",
): number {
  ctx.save();
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  let ox = align === "right" ? x - (textWidth(text, scale) - scale) : x;
  for (const ch of text) {
    const g = GLYPH[ch] ?? GLYPH[" "];
    for (let row = 0; row < g.length; row++) {
      for (let col = 0; col < g[row].length; col++) {
        if (g[row][col] === "#") {
          ctx.fillRect(ox + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    ox += glyphWidth(ch, scale);
  }
  ctx.restore();
  return ox;
}
