import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("le webhook Telegram expose les boutons et les deux plannings",()=>{
  const source=readFileSync(new URL("./telegram.js",import.meta.url),"utf8");
  assert.match(source,/Planning Salle/);
  assert.match(source,/Planning Cuisine/);
  assert.match(source,/nextWeekLabel/);
  assert.match(source,/confirm_action/);
  assert.match(source,/TELEGRAM_ADMIN_IDS/);
});
