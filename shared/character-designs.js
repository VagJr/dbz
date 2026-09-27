(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UZDesigns = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Explicit model sheets: outfit, trim, skin, hair, silhouette and identity features.
  const data = `
goku|f87928|1645a2|f5bc92|101b2b|spike|gi|emblem
vegeta|254dba|e7ce87|edb78e|101725|crest|armor|
gohan|70439a|b32734|efbd91|171c28|short|gi|
goten|ed812b|244faf|f2bb90|151b27|spike|gi|small
trunks|5968b3|e44d32|efbd99|bca0e4|part|jacket|sword
futuregohan|ed782a|19498e|edb386|172130|short|gi|scar,onearm
bardock|284c48|b93835|cb926c|101d26|spike|armor|band,tail,scar
raditz|60452f|d5bb7e|d9a179|17202b|mane|armor|tail,scouter
nappa|443321|d2b16e|d9a376|none|none|armor|wide,moustache,tail
broly|70518e|6dbf49|dda275|15202b|wild|bare|large,pelt
pan|e6503d|596295|f0bd93|172031|bob|jacket|small,band
cabba|a9433c|ead8b0|ecc09c|152030|short|armor|slim
caulifla|ca486e|525982|edb18e|141d2d|wild|bare|slim
kale|ad3e55|e6c584|bb8462|172027|pony|bare|slim
krillin|ed7c2d|164c9c|f2b68a|none|none|gi|small,dots
yamcha|e87d2d|164888|e7aa7d|172330|mane|gi|scar
tien|388e59|bd2838|dbaf88|none|none|gi|thirdEye
roshi|df9440|ede1c5|dfaa7d|none|none|gi|beard,glasses,shell,staff
chiaotzu|69a752|bf443e|f3eee2|none|none|robe|small,cap,cheeks
yajirobe|d47c48|243c63|d49c78|20202b|bob|robe|wide,sword
piccolo|70459e|338ec3|72bb63|none|none|gi|namek,cape,turban
dende|eddfbd|aa5062|75ba68|none|none|robe|namek,small
nail|eeeece|a44f3b|75b65c|none|none|bare|namek
kingpiccolo|674787|cb514a|78b154|none|none|robe|namek,large
bulma|f1a2b2|c84262|f0bd96|48b9bb|bob|jacket|slim,band
android16|659541|242b35|e4b196|d56939|crest|armor|large,rr
android17|252e3c|e6813d|e9b798|17222c|part|jacket|scarf,rr
android18|5576ae|d8ddd8|edbfa0|e9cc6c|bob|jacket|slim,stripes
gero|765339|d79848|ddb594|e5e0cf|mane|robe|cap,rr,moustache
cell|77b643|222b38|b6c09b|none|none|cell|carapace,spots
frieza|e9e8f5|974ed0|e8e7f0|none|none|alien|tail,gem
cooler|6f558f|d6dde7|b8adce|none|none|alien|tail,horns,mask
kingcold|677fa3|ddd5ad|bc9ac9|none|none|armor|large,tail,horns,cape
zarbon|315c80|e2c886|87be9b|276a46|pony|armor|earrings
dodoria|3c4050|d9bc7c|d687a3|none|none|armor|wide,spines
ginyu|303345|d9c888|a17bb7|none|none|armor|horns,scouter
buu|f1e9d5|7c458c|ed9dbc|none|none|majin|wide,cape,antenna
dabura|446fac|f2e5d5|c26969|131d29|short|robe|horns,cape,beard
beerus|344c97|e8bd55|9c6cc0|none|none|god|ears,tail,slim
whis|8d3452|63c7de|aed6ed|e5f5ff|crest|angel|halo,staff,slim
champa|874467|e6bd58|aa7bab|none|none|god|ears,tail,wide
vados|3a805c|62c8d7|a1cde8|e7f7ff|pony|angel|halo,staff,slim
jiren|dc4051|202634|b8c2ce|none|none|suit|large,alienEyes
hit|60436e|2b2b46|a085b8|none|none|coat|brow
toppo|bf3447|252734|b9947b|none|none|suit|wide,moustache
dyspo|cd3d55|232434|b189b9|none|none|suit|ears,slim
zamasu|5b576a|d44750|82b999|e2eaf0|crest|kai|pointed,earrings
gokuBlack|363542|c34852|e5b390|161e2b|spike|gi|earrings
janemba|b74d66|9273ad|c26178|none|none|alien|horns,tail
hirudegarn|6b7855|c0bb8e|87936a|none|none|alien|giant,horns,tail,carapace
tapion|6b9878|c8a54a|d8ab86|d87543|crest|robe|sword,pointed,scarf
granolah|a27749|416467|e1b492|84a88b|part|jacket|scouter,scarf
gas|38485c|b4ad8c|9babb2|111b29|mane|robe|pointed
moro|45728b|cbbb9c|91b3ba|e4e4d8|mane|robe|horns,beard
baby|dadfe3|b44748|a4c5bc|cddfeb|crest|alien|gem
omega|deded4|42738d|d6d6cc|none|none|dragon|spines,gem,large
shugesh|4e392f|dcc184|c99272|192331|short|armor|wide,tail,scouter
pilaf|39869b|cb4259|84c0cc|none|none|robe|small,cap,pointed
tao|d691bc|262e3a|d5a27d|161e27|braid|robe|moustache
kingkai|24304b|d8be54|88bdcf|none|none|robe|wide,antenna,glasses
kaioshin|715280|d4a667|c2a4d7|e6eaf1|crest|kai|pointed,earrings
yakon|486345|b0b67d|718f52|none|none|alien|large,spines,claws
spopovich|a16c3a|373441|d7ae87|none|none|bare|large,majin
pikkon|ede7c8|96549b|8aaa8b|none|none|robe|cape,turban
uub|c5803a|677a93|ae785b|172027|crest|gi|small
videl|e4e8dc|6e668e|ecc09f|172337|braid|jacket|slim
turtle|899458|9b713d|a3ae7f|none|none|animal|shell,wide
yardrat|72659b|d56987|d396ac|none|none|robe|small,pointed
kanassan|567895|d0b786|8bb1b4|none|none|alien|spines
chichi|855caf|d46b4a|e5b08d|142030|bun|robe|slim
oxking|67937f|d7b879|c3916d|20272d|none|armor|giant,horns,beard,glasses
launch|69a95e|d54745|edbd97|e4c76d|wild|jacket|band,slim
oolong|688b65|dcbd7d|d9a09a|none|none|animal|snout,ears,small
puar|7db8d4|ede2b3|91c4d8|none|none|animal|ears,tail,small
arale|8d729d|e89ea4|edc0a4|75619d|mane|jacket|cap,glasses,small
korin|e4e3d7|8a9c9e|f1efdf|none|none|animal|ears,tail,staff,small
popo|eee8cc|9a3639|343952|none|none|robe|wide,turban
shenron|579958|d1bc72|6baa65|none|none|serpent|horns
porunga|78a755|c6b27c|8cb865|none|none|dragon|horns,large,tail,spines
superShenron|caa64d|f6df90|e5c56c|none|none|serpent|horns,large
generalBlue|879c71|bf4743|ebbe9a|e8ca6a|short|jacket|rr
commanderRed|915c50|dba95b|d6a07c|d37848|short|jacket|rr,small,eyepatch
tambourine|537352|caa382|84a96e|none|none|alien|wings,pointed
drWheelo|4b666c|bca780|a4b3aa|none|none|robot|giant,brain
garlicJr|4b6553|bf924c|6f9e87|none|none|robe|pointed,small
turles|3b3c50|d3d0c3|bd9376|151e2a|spike|armor|tail,scouter
slug|684886|ca8b47|96ab61|none|none|robe|namek,large,turban
bojack|b79554|4a876d|83b8a9|cc7651|mane|jacket|large,scarf
recoome|313443|c8ac70|dfa783|db8a4e|crest|armor|large,scouter
jeice|30394f|f3e8ca|c76a59|eee8d8|mane|armor|scouter
burter|30394c|e0bf86|7197b7|none|none|armor|large,scouter
guldo|425148|d9bd78|94b270|none|none|armor|wide,fourEyes,small
android19|eddfb2|b46635|ece0ce|none|none|robe|wide,cap,rr
android20|785039|d79945|deb99d|e1dcca|mane|robe|cap,rr,moustache
cellJr|6289b9|222c43|a8bca6|none|none|cell|small,carapace,spots
babidi|bb8a3e|665145|b7b476|none|none|robe|small,pointed
kibito|9b535d|e4c587|daab9e|e9e0d2|mane|kai|large,pointed
frost|d8e2de|6680b4|d3dbdd|none|none|alien|tail,gem
magetta|737e83|b1aaa0|9dabad|none|none|robot|wide,rivets
botamo|e5c75f|bb443c|e5c66b|none|none|animal|wide,ears
kefla|ba4b78|dcaf53|ddb085|18222d|wild|bare|earrings,slim
fusedZamasu|4f5261|b93948|94bfa3|eef4f1|crest|kai|pointed,earrings
kunshi|c33b50|28323c|9ba9af|none|none|suit|small
monaito|dbbd93|ab6d5e|93b079|none|none|robe|namek,small
elec|bfccbd|d2b260|8aa2b6|2e384a|mane|robe|pointed
maki|5b6c96|d5be84|98b8cd|957aae|bob|jacket|slim,glasses
oil|64718a|d4ad72|809ba7|18262f|short|jacket|wide
monaka|b04468|b8964c|be7a87|none|none|bare|ears,slim
panzy|cf8149|b49564|dcb593|ae8bc0|bob|jacket|cap,glasses,small
glorio|4b526c|a47f6c|83b3d5|e8eff5|short|jacket|pointed
gomah|aa5558|c2a467|a387a1|none|none|robe|small,pointed,cap
degésu|4d5862|cebc7a|9d9bb3|d7d9e2|crest|kai|pointed
neva|9b8f6c|cdbfa1|9ba56d|none|none|robe|namek,beard
arinsu|ab6c74|f2e3ca|a0b4bd|e1dce6|mane|robe|pointed,glasses,slim
super17|343b47|cf773b|dcb093|192431|mane|jacket|scarf,large
novaShenron|d0a14a|e9ca79|c3954b|none|none|dragon|spines,gem
iceShenron|83b1c9|d3eef4|a8d0df|none|none|dragon|spines,gem
rildo|567e73|b8c6a1|8ba98e|none|none|robot|large,gem
paragus|715676|d2b16a|c19479|53565c|short|armor|moustache,scar
gogeta|e8ddcb|dc9d45|e6b28b|132133|spike|vest|
vegito|325aab|ec852e|edb994|182131|crest|gi|earrings
golden|dfb343|91429a|ebc261|none|none|alien|tail,gem
blackfrieza|383f54|bcc4d7|626981|none|none|alien|tail,gem
kidbuu|eee5cd|3e2d53|df90b0|none|none|majin|antenna,slim
soldier|455c70|d1c390|dab894|354658|short|armor|scouter
android|5576ae|d8ddd8|edbfa0|e9cc6c|bob|jacket|stripes
kai|24304b|d8be54|88bdcf|none|none|robe|wide,antenna,glasses
black|363542|c34852|e5b390|e695c9|spike|gi|earrings
demon|795080|d0a468|b77f96|none|none|robe|horns
`;
  const designs = Object.fromEntries(
    data
      .trim()
      .split("\n")
      .map((row) => {
        const [id, cloth, trim, skin, hair, cut, rig, flags = ""] =
          row.split("|");
        return [
          id,
          {
            id,
            cloth: "#" + cloth,
            trim: "#" + trim,
            skin: "#" + skin,
            hair: hair === "none" ? null : "#" + hair,
            cut,
            rig,
            flags: flags.split(",").filter(Boolean),
          },
        ];
      }),
  );
  return designs;
});
