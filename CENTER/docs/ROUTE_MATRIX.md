# PUBLIC ROUTE MATRIX — V5

This matrix records the source renderer and the required acceptance method. `Static` means the route branch and fallback are present in source; `Browser` requires a real browser run.

| Route family | Renderer | Static | Browser |
|---|---|---:|---:|
| `/` | CMS Home when valid; resilient fallback Home otherwise | PASS | NOT VERIFIED |
| `/<published CMS slug>` | CMS Published Snapshot with empty-snapshot guard | PASS | NOT VERIFIED |
| `/record/:id` | Public record detail + related records when permitted | PASS | NOT VERIFIED |
| `/explore` and filtered Explore | Knowledge Explorer/search/filter/empty state | PASS | NOT VERIFIED |
| `/about` | CMS or editorial fallback | PASS | NOT VERIFIED |
| `/contact` | CMS or contact fallback | PASS | NOT VERIFIED |
| `/privacy` | Policy content | PASS | NOT VERIFIED |
| `/fields` | 18-field taxonomy with deep-linkable discovery entries | PASS | NOT VERIFIED |
| `/research` | Research Atlas pipeline + real public project/data/output lanes | PASS | NOT VERIFIED |
| `/research-groups` | Group constellation + public project context | PASS | NOT VERIFIED |
| `/people` | People constellation from public member profiles | PASS | NOT VERIFIED |
| `/knowledge`, `/resources` | Knowledge graph/inspector + publication/data/resource lanes | PASS | NOT VERIFIED |
| `/innovation`, `/ideas`, `/experiments` | Innovation Sandbox process flow + public ideas/challenges/projects | PASS | NOT VERIFIED |
| `/activities`, `/news`, `/programs`, `/community`, `/opportunities` | Activity timeline + public contribution lane | PASS | NOT VERIFIED |
| `/orientation`, `/structure`, `/sky-first-network`, `/impact` | Editorial context pages | PASS | NOT VERIFIED |
| `/collaboration`, `/network`, `/for-people`, `/for-organizations`, `/proposals` | Connection pages | PASS | NOT VERIFIED |
| unknown path | Explicit 404 state | PASS | NOT VERIFIED |
| `#login`, `#setup`, `#reset/:token` | Auth/setup/reset | PASS via automated auth tests | NOT VERIFIED visually |
| `#w/*` Workspace/Admin | Existing hash router, RBAC and CMS Studio | PASS via 78 automated tests/source | NOT VERIFIED visually |

## Required browser matrix after handoff

Run at widths `1440, 1280, 1024, 768, 430, 390, 360` and modes `light, dark, reduced-motion` for Home, About, Fields, Research, Projects/Explore, People, Knowledge, Innovation, Activities, Contact, 404, Login, Workspace and CMS Studio. Record HTTP, renderer, dynamic data, empty state, console errors and visual result for each route.
