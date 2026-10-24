// 1. On récupère les éléments de la page
const canvas = document.querySelector("#visualiseur");
const pinceau = canvas.getContext("2d");
const lecteurs = document.querySelectorAll("audio");

let audioContext;
let analyseur;
let donnees;

// 2. On prépare l'analyse du son (une seule fois)
function initialiserAudio() {
  audioContext = new AudioContext();
  analyseur = audioContext.createAnalyser();
  analyseur.fftSize = 128;
  donnees = new Uint8Array(analyseur.frequencyBinCount);
  analyseur.connect(audioContext.destination);

  lecteurs.forEach(function (lecteur) {
    const source = audioContext.createMediaElementSource(lecteur);
    source.connect(analyseur);
  });

  dessiner();
}

// 3. Quand on lance un morceau
lecteurs.forEach(function (lecteur) {
  lecteur.addEventListener("play", function () {
    if (!audioContext) {
      initialiserAudio();
    }
    audioContext.resume();

    // On met les autres morceaux en pause
    lecteurs.forEach(function (autre) {
      if (autre !== lecteur) {
        autre.pause();
      }
    });
  });
});

// 4. On dessine les barres, en boucle
function dessiner() {
  requestAnimationFrame(dessiner);
  analyseur.getByteFrequencyData(donnees);

  pinceau.clearRect(0, 0, canvas.width, canvas.height);
  const largeurBarre = canvas.width / donnees.length;

  donnees.forEach(function (valeur, i) {
    const hauteur = (valeur / 255) * canvas.height;
    pinceau.fillStyle = "#eb4f34";
    pinceau.fillRect(i * largeurBarre, canvas.height - hauteur, largeurBarre - 2, hauteur);
  });
}
