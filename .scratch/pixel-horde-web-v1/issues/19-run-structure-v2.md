# 19: 8-Chapter Run, route choice, King-must-die, Escape and the new Score

**What to build:** A Run is 8 Chapters: Greenvale first, a 1-of-2 route choice for Chapters 2–7 (using the existing Realms until new ones land), Heart Crater placeholder last. A Stage clears only when its King dies; overtime then Escape (King flees, no King rewards, Umbra strength +1, one re-pick per Chapter). Difficulty follows the Chapter number. Special events only in Chapters 2–7 and Blood Moon is never announced. The Score formula of the spec replaces the old one, with an itemised count-up at Run end.

**Blocked by:** 04 (Determinism guardrails, headless test harness, golden replay and CI); 05 (Balance Config schema with every tunable number)

**Status:** done (awaiting owner playtest)

- [x] Route screen shows Realm name, traits, resisted element and advised Skills
- [x] Overtime length and Escape effects come from Balance Config
- [x] Sim tests: Stage clears only on King death; Escape consequences; route validity; Score equals formula for fixture Runs
- [x] Golden replay regenerated and documented as an intentional behaviour change

## Notes (implementation)

- Realms: `packages/sim/src/content/lumora/realms.ts` (11 Realms incl. Heart Crater; `available` flags gate the 6 Realms whose content lands in tickets 35–38). Route choices use the `route` RNG stream: 2 unvisited available Realms, topped up from already-visited ones when fewer than 2 remain.
- Balance Config: `stage.{chapters, overtime, enrageSpd, enrageDmg, overtimeSpawn, escapeRepicks, kingGold, umbraEscapeHp, bloodMoonRevealAt}`, `events.lastChapter`, `score.*`, `enemies.umbra`.
- Golden replays (`tests/golden/*.json`) were regenerated on purpose: the Stage now ends only when the King dies (or escapes after overtime), so every hash after the first Stage end changed.
- Game UI: route screen (`#ovRoute`), HUD `CH n REALM` + overtime countdown, escape text on the clear screen, victory title and itemised Score count-up on the Run-end screen, Heart Crater tiles and a placeholder Umbra sprite (crowned hero shadow).
- Tests: `tests/sim.bot.test.ts` (escape + re-pick, King kill → Chapter 2 via route), `tests/score.test.ts` (blueprint examples 80,900 / 24,150), `tests/browser/route.spec.ts`.

### Interpretations to confirm with the owner
1. The Stage timer is a minimum: at the timer end the Stage clears only if the King is dead; otherwise 45 s overtime (King enraged ×1.3 speed/damage, spawns ×1.5), then the King escapes.
2. After an Escape the Chapter can be replayed once in a different Realm (Chapter 1 replays Greenvale); a second Escape moves on to the next Chapter.
3. Umbra never escapes; each Escape during the Run adds +15% Umbra HP.
4. Blood Moon reveals itself at 10% of the Stage with no advance notice.
5. The Inferno Dragon no longer replaces the King; both can appear in the same Stage.
6. A non-aiming test bot fails to kill the Chapter-1 King (2,200 HP) in time, so real players who kite without focusing the King will see overtime often. Worth checking in the playtest.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
