# Homepage Version 7 check

URL: http://localhost:4177/version-7

| Result | Check | Detail |
| --- | --- | --- |
| PASS | server: 200 | status 200 |
| PASS | server: X-Robots-Tag noindex | noindex, nofollow |
| PASS | phone: no horizontal scroll | scrollWidth 390 |
| PASS | phone: every live section id present |
| PASS | phone: H1 is the live headline | Cybersecurity-First IT That Powers Your Business |
| PASS | phone: robots meta noindex | noindex, nofollow |
| PASS | phone: images load and carry alt |
| PASS | phone: no console errors |
| PASS | tablet: no horizontal scroll | scrollWidth 768 |
| PASS | tablet: every live section id present |
| PASS | tablet: H1 is the live headline | Cybersecurity-First IT That Powers Your Business |
| PASS | tablet: robots meta noindex | noindex, nofollow |
| PASS | tablet: images load and carry alt |
| PASS | tablet: no console errors |
| PASS | desktop: no horizontal scroll | scrollWidth 1440 |
| PASS | desktop: every live section id present |
| PASS | desktop: H1 is the live headline | Cybersecurity-First IT That Powers Your Business |
| PASS | desktop: robots meta noindex | noindex, nofollow |
| PASS | desktop: images load and carry alt |
| PASS | desktop: no console errors |
| PASS | bar: opening screen shows Ask DE, not tucked | {"auto":"shown","expanded":false,"y":0,"askDE":true} |
| PASS | bar: once the hero scrolls, the chapter dock opens | {"auto":"shown","expanded":true,"y":600,"askDE":true} |
| PASS | bar: reading down tucks to the Ask DE button | {"auto":"tucked","expanded":false,"y":1800,"askDE":true} |
| PASS | bar: after a flick up, a 120px read does not tuck it again | {"auto":"shown","expanded":true,"y":1860,"askDE":true} |
| PASS | bar: a 20px wobble up stays tucked | {"auto":"tucked","expanded":false,"y":2240,"askDE":true} |
| PASS | bar: a deliberate flick up brings it back | {"auto":"shown","expanded":true,"y":2180,"askDE":true} |
| PASS | bar: active chapter shows read progress |
| PASS | bar: pointer resting near the bottom edge brings it back | {"auto":"shown","expanded":true,"y":2980,"askDE":true} |
| PASS | bar: pointer over the bar holds it | {"auto":"shown","expanded":true,"y":3580,"askDE":true} |
| PASS | bar: end of page shows it | {"auto":"shown","expanded":false,"y":15205,"askDE":true} |
| PASS | bar (phone): typing in a field steps the bar aside | {"auto":"typing","h":"0px"} |

31/31 checks passed.
