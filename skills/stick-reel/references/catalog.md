# Catalog (generated from engine/stick.js by scripts/catalog.mjs — do not edit by hand)

Use ONLY these names. The build stops with "Did you mean ..." on anything else.

## Poses (`"pose"` on a char, or `{"act":"pose","pose":...}`)
`stand` · `relaxed` · `point` · `pointUp` · `pointDown` · `pointSide` · `present` · `wave` · `cheer` · `handsUp` · `shrug` · `think` · `facepalm` · `armsCrossed` · `hips` · `sad` · `shock` · `scared` · `sit` · `sitFloor` · `sitHug` · `kneel` · `crouch` · `lie` · `fallen` · `bow` · `hold` · `holdUp` · `phone` · `call` · `type` · `talk` · `explain` · `flex` · `run` · `jump` · `push` · `pull` · `lookUp` · `lookDown` · `victory` · `dab` · `salute` · `pray` · `tired` · `angry` · `sneak` · `carry`

Joints you can override inside a pose action (degrees): `lean`, `head`, `sF`, `eF`, `spF`, `fpF`, `sB`, `eB`, `spB`, `fpB`, `hF`, `kF`, `hB`, `kB`, `lsp`

## Gestures (`{"act":"gesture","kind":...,"dur":s}`)
`wave` · `nod` · `no` · `laugh` · `tremble` · `clap` · `scratch` · `dance` · `typing` · `cry` · `pant` · `bounce` · `fist` · `shiver` · `talk`

## Expressions (`"expr"`)
`neutral` · `happy` · `grin` · `sad` · `angry` · `shock` · `worried` · `smirk` · `sleepy` · `love` · `dead` · `cry` · `confused` · `excited` · `determined` · `joy` · `content` · `disgust` · `bored` · `blank`

## Emote icons (`{"act":"emote","icon":...}`)
`!` · `?` · `heart` · `idea` · `sweat` · `anger` · `zzz` · `music` · `sparkle` · `dots` · `check` · `cross` · `dollar` · `skull`

## Hair / hats (cast `"hair"`)
`none` · `tuft` · `spiky` · `bob` · `long` · `bun` · `ponytail` · `cap` · `tophat` · `beanie` · `bow` · `crown` · `curly` · `mohawk`

## Accessories (cast `"acc": [...]`)
`tie` · `bowtie` · `glasses` · `mustache` · `beard` · `scarf` · `headphones` · `badge`

## Sets (scene `"set"`)
`none` · `void` · `room` · `bedroom` · `office` · `street` · `city` · `park` · `classroom` · `kitchen` · `space` · `stage`

## Themes
`paper` · `chalk` · `night` · `sky` · `blueprint` · `sunset`

## Transitions (scene `"transition"`, into the NEXT scene)
`push` · `whip` · `slideUp` · `zoom` · `dissolve` · `dip` · `iris` · `wipe` · `cut`

## Colours (or any #hex)
`red` · `blue` · `yellow` · `green` · `orange` · `pink` · `purple` · `gray` · `brown` · `sky` · `mint` · `gold` · `black` · `white` · `leaf` · `skin` · `navy`

## Text types
`title` · `label` · `note` · `sticker` · `bubble` · `thought` · `counter` · `arrow` · `circle` · `underline` · `strike`

## Props (`"kind"`) — anchor, notes
| kind | anchor | notes |
|---|---|---|
| `table` | bottom |  |
| `desk` | bottom |  |
| `chair` | bottom | seat fits a size-1 "sit" pose; back is on the left (flip: true for the other side) |
| `stool` | bottom |  |
| `sofa` | bottom |  |
| `bed` | bottom | lie on it with y = 1140 |
| `door` | bottom |  |
| `window` | centre | night: true = dark pane |
| `frame` | centre |  |
| `tree` | bottom |  |
| `pine` | bottom |  |
| `bush` | bottom |  |
| `flower` | bottom |  |
| `cloud` | centre | rain: true |
| `sun` | centre | rays turn |
| `moon` | centre |  |
| `star` | centre |  |
| `mountain` | bottom |  |
| `hill` | bottom |  |
| `house` | bottom |  |
| `building` | bottom | h, w |
| `shop` | bottom | text |
| `car` | bottom | wheels roll when it moves |
| `bike` | bottom | wheels roll |
| `plane` | centre |  |
| `rocket` | centre | flame flickers |
| `laptop` | bottom | text on screen |
| `monitor` | bottom | text |
| `tv` | bottom | text |
| `phone` | grip (hand) | held: grip |
| `cup` | grip (hand) | held; steam: true |
| `book` | grip (hand) | held |
| `briefcase` | grip (hand) | held |
| `bag` | grip (hand) | held |
| `moneybag` | bottom |  |
| `coin` | centre |  |
| `cash` | centre |  |
| `dollar` | centre |  |
| `heart` | centre |  |
| `brokenheart` | centre |  |
| `bulb` | centre | rays: false |
| `clock` | centre | value = hours, e.g. 10.5 (animate it to spin) |
| `hourglass` | centre |  |
| `calendar` | centre | text |
| `sign` | bottom | text |
| `placard` | grip (hand) | held; text |
| `board` | bottom | text |
| `chart` | bottom | values: [..] bars grow in on show; anim "value" 0-1 |
| `graph` | bottom | values: [..] line draws in on show |
| `battery` | centre | value 0-1 (animate it) |
| `meter` | centre | value 0-1 needle |
| `trophy` | bottom |  |
| `medal` | centre |  |
| `flag` | bottom | waves |
| `gift` | bottom |  |
| `box` | bottom |  |
| `bomb` | centre | fuse sparks |
| `fire` | bottom | flickers |
| `boom` | centre | text |
| `key` | centre |  |
| `lock` | centre | open: true |
| `mail` | centre |  |
| `bell` | centre |  |
| `magnifier` | centre |  |
| `pill` | centre |  |
| `globe` | centre |  |
| `ball` | centre |  |
| `balloon` | grip (hand) | held |
| `umbrella` | grip (hand) | held |
| `megaphone` | grip (hand) | held |
| `dog` | bottom |  |
| `cat` | bottom |  |
| `bird` | centre |  |
| `grave` | bottom | text |
| `ladder` | bottom |  |
| `stairs` | bottom |  |
| `plant` | bottom |  |
| `lamp` | bottom |  |
| `streetlamp` | bottom |  |
| `fence` | bottom |  |
| `fridge` | bottom |  |
| `counter` | bottom |  |
| `trash` | bottom |  |
| `cart` | bottom |  |
| `burger` | centre |  |
| `apple` | centre |  |
| `crown` | centre |  |
| `brain` | centre |  |
| `target` | centre |  |
| `arrow` | centre |  |
| `check` | centre |  |
| `cross` | centre |  |
| `qmark` | centre |  |
| `exmark` | centre |  |
| `drop` | centre |  |
| `snowman` | bottom |  |
