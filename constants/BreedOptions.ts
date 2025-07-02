// BreedOptions.ts
// Mapping of pet categories -> types -> breeds list for dropdowns
export interface BreedOption {
  label: string;
  value: string;
}

export interface TypeBreedMap {
  [typeValue: string]: BreedOption[];
}

export interface CategoryMap {
  [categoryValue: string]: {
    label: string;
    types: { label: string; value: string; breeds: BreedOption[] }[];
  };
}

export const breedData: CategoryMap = {
  mammals: {
    label: 'Mammals',
    types: [
      {
        label: 'Dog',
        value: 'dog',
        breeds: [
          'Aspin','Shih Tzu','Chihuahua','Pomeranian','Labrador Retriever','Poodle (Toy/Mini)','Siberian Husky','German Shepherd','Beagle','Dachshund'
        ].map(b => ({ label: b, value: b.toLowerCase().replace(/\s+/g,'_')})),
      },
      {
        label: 'Cat',
        value: 'cat',
        breeds: [
          'Puspin (Pusang Pinoy)','Persian','Siamese','British Shorthair','Scottish Fold','American Shorthair','Maine Coon','Ragdoll','Exotic Shorthair','Bengal'
        ].map(b => ({ label: b, value: b.toLowerCase().replace(/[^a-z0-9]/gi,'_')})),
      },
      {
        label: 'Rabbit',
        value: 'rabbit',
        breeds: [ 'New Zealand White','Holland Lop','Lionhead','Rex','Mini Rex','Flemish Giant','Netherland Dwarf','American Fuzzy Lop','Angora','Californian' ].map(convert),
      },
      {
        label: 'Guinea Pig', value: 'guinea_pig', breeds: [ 'American','Abyssinian','Peruvian','Teddy','Silkie (Sheltie)','Texel','White Crested','Coronet','Skinny Pig (hairless)','Baldwin'].map(convert),
      },
      { label: 'Hamster', value: 'hamster', breeds: ['Syrian','Roborovski','Campbell\'s Dwarf','Winter White Dwarf','Chinese','Hybrid Dwarf','Long-haired Syrian (Teddy Bear)','Albino Dwarf','Black Syrian','Russian Dwarf'].map(convert) },
      { label: 'Mouse', value: 'mouse', breeds: ['Fancy Mouse','Feeder Mouse','Hairless Mouse','Satin Mouse','Show Mouse','Brindle Mouse','Albino Mouse','Long-haired Mouse','Frizzy (Rex) Mouse','Spiny Mouse'].map(convert)},
      { label: 'Rat', value: 'rat', breeds: ['Fancy Rat','Dumbo Rat','Hairless Rat','Rex Rat','Albino Rat','Siamese Rat','Hooded Rat','Manx Rat (tailless)','Bristle Coat Rat','Burmese Rat'].map(convert)},
      { label: 'Pig', value: 'pig', breeds: ['Native Pig (Philippine Native)','Large White','Landrace','Duroc','Pietrain','Berkshire','Hampshire','Chester White','Tamworth','Pot-bellied Pig'].map(convert) }
    ],
  },
  birds: {
    label: 'Birds',
    types: [
      { label: 'Lovebird', value: 'lovebird', breeds: ['Fischer\'s Lovebird','Peach-faced Lovebird','Masked Lovebird','Lutino Lovebird','Albino Lovebird','Blue Peach-faced Lovebird','Yellow-collared Lovebird','Black-cheeked Lovebird','Nyasa Lovebird','Madagascar Lovebird'].map(convert)},
      { label: 'Parakeet', value: 'parakeet', breeds: ['Budgerigar (Budgie)','Indian Ringneck','Alexandrine Parakeet','Monk Parakeet (Quaker)','Plum-headed Parakeet','Moustached Parakeet','Bourke\'s Parakeet','Lineolated Parakeet','Psittacula Parakeet','Grass Parakeet'].map(convert)},
      { label: 'Maya', value: 'maya', breeds: ['Chestnut Munia (Philippine Maya)','Eurasian Tree Sparrow','Black-headed Munia','Scaly-breasted Munia','White-bellied Munia','Java Sparrow','Red Avadavat','Yellow-breasted Munia','Plain Munia','Bronze Mannikin'].map(convert)},
      { label: 'Cockatiel', value: 'cockatiel', breeds: ['Normal Grey Cockatiel','Lutino Cockatiel','Pearl Cockatiel','Pied Cockatiel','White-faced Cockatiel','Cinnamon Cockatiel','Albino Cockatiel','Fallow Cockatiel','Silver Cockatiel','Yellow-cheeked Cockatiel'].map(convert)},
      { label: 'Dove', value: 'dove', breeds: ['Philippine Collared Dove','Zebra Dove','Red Turtle Dove','Spotted Dove','White-winged Dove','Rock Dove (Pigeon)','Diamond Dove','Laughing Dove','Emerald Dove','Pied Imperial Pigeon'].map(convert)},
      { label: 'Pigeon', value: 'pigeon', breeds: ['Rock Pigeon','Racing Homer','King Pigeon','Philippine Green Pigeon','Jacobin Pigeon','Fantail Pigeon','Lahore Pigeon','Modena Pigeon','Chinese Owl Pigeon','English Carrier'].map(convert)},
    ],
  },
  fish: {
    label: 'Fish',
    types: [
      { label: 'Goldfish', value: 'goldfish', breeds: ['Common Goldfish','Comet Goldfish','Fantail Goldfish','Ryukin Goldfish','Oranda Goldfish','Black Moor Goldfish','Ranchu Goldfish','Bubble Eye Goldfish','Celestial Eye Goldfish','Pearlscale Goldfish'].map(convert)},
      { label: 'Koi', value: 'koi', breeds: ['Kohaku','Taisho Sanke (Sanke)','Showa Sanshoku (Showa)','Shusui','Asagi','Utsurimono','Bekko','Ogon','Goshiki','Doitsu'].map(convert)},
      { label: 'Betta Fish', value: 'betta', breeds: ['Veiltail Betta','Crowntail Betta','Halfmoon Betta','Double Tail Betta','Plakat Betta','Delta Tail Betta','Super Delta Betta','Rosetail Betta','Halfmoon Plakat','Dumbo (Elephant Ear) Betta'].map(convert)},
      { label: 'Tilapia', value: 'tilapia', breeds: ['Nile Tilapia','Mozambique Tilapia','Red Tilapia','Blue Tilapia','Wami Tilapia','Zanzibar Tilapia','Aureus Tilapia','Hornorum Tilapia','Galilaea Tilapia','Rendalli Tilapia'].map(convert)},
      { label: 'Tetra', value: 'tetra', breeds: ['Neon Tetra','Cardinal Tetra','Black Skirt Tetra','Glowlight Tetra','Ember Tetra','Rummy Nose Tetra','Lemon Tetra','Serpae Tetra','Diamond Tetra','Congo Tetra'].map(convert)},
      { label: 'Guppy', value: 'guppy', breeds: ['Fancy Guppy','Endler Guppy','Cobra Guppy','Tuxedo Guppy','Moscow Guppy','Delta Tail Guppy','Half Black Guppy','Albino Guppy','Grass Tail Guppy','Snakeskin Guppy'].map(convert)},
      { label: 'Molly', value: 'molly', breeds: ['Black Molly','Sailfin Molly','Balloon Molly','Lyretail Molly','Dalmatian Molly','Gold Dust Molly','Marble Molly','Silver Molly','Shortfin Molly','Creamsicle Molly'].map(convert)},
    ],
  },
  reptiles: {
    label: 'Reptiles',
    types: [
      { label: 'Turtle', value: 'turtle', breeds: ['Red-eared Slider','Philippine Pond Turtle','Softshell Turtle','Yellow-bellied Slider','River Cooter','Painted Turtle','Snapping Turtle','Common Musk Turtle','African Sideneck Turtle','Map Turtle'].map(convert)},
      { label: 'Gecko', value: 'gecko', breeds: ['Tokay Gecko','Common House Gecko','Leopard Gecko','Crested Gecko','Gargoyle Gecko','Golden Gecko','Flying Gecko','Day Gecko','Moorish Gecko','Chinese Cave Gecko'].map(convert)},
      { label: 'Snake', value: 'snake', breeds: ['Philippine Cobra','Reticulated Python','Ball Python','Burmese Python','Green Tree Python','Corn Snake','King Snake','Rat Snake','Garter Snake','Milk Snake'].map(convert)},
      { label: 'Lizard', value: 'lizard', breeds: ['Common House Lizard (Butiki)','Philippine Sailfin Lizard','Monitor Lizard (Bayawak)','Flying Dragon (Draco Lizard)','Green Iguana','Brown Anole','Tokay Gecko','Long-tailed Grass Lizard','Frilled Lizard','Bearded Dragon'].map(convert)},
    ],
  },
  amphibians: {
    label: 'Amphibians',
    types: [
      { label: 'Frog', value: 'frog', breeds: ['Philippine Horned Frog','Common Tree Frog','Cane Toad','Asian Grass Frog','Bullfrog','Leopard Frog','Green Paddy Frog','Pond Frog','Tomato Frog','Poison Dart Frog'].map(convert)},
      { label: 'Toad', value: 'toad', breeds: ['Cane Toad','Asian Common Toad','Philippine Flat-headed Toad','Luzon Forest Toad','Mindanao Horned Toad','Asian Giant Toad','Rice Field Toad','Marsh Toad','Luzon Narrow-mouthed Toad','Dwarf Toad'].map(convert)},
      { label: 'Newt', value: 'newt', breeds: ['Japanese Fire-Bellied Newt','Chinese Fire-Bellied Newt','Eastern Newt','Iberian Ribbed Newt','Alpine Newt','Smooth Newt','California Newt','Tylototriton Newt','Cynops Orientalis','Vietnamese Warty Newt'].map(convert)},
      { label: 'Salamander', value: 'salamander', breeds: ['Chinese Giant Salamander','Japanese Giant Salamander','Tiger Salamander','Axolotl','Spotted Salamander','Fire Salamander','Slimy Salamander','Marbled Salamander','Eastern Red-backed Salamander','Blue-spotted Salamander'].map(convert)},
    ],
  },
};

function convert(label: string): BreedOption {
  return { label, value: label.toLowerCase().replace(/[^a-z0-9]/gi,'_') };
} 