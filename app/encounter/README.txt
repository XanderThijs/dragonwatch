Encounter lab engine and trained model, bundled so Dragonwatch works on its own.
Dragonwatch loads engine.js, model.json and lab-monsters.json from here (live win chance and "Generate with Encounter lab").
They are copies of web/engine.js, web/model.json and web/monsters.json from the Encounter lab project
(lab-monsters.json is the lab's monsters.json: the SRD creatures reduced to the numbers the simulator needs).
Train a new model there and copy those three files over to update it.
