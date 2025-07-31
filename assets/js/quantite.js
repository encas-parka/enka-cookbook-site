// réccupérer le nombre d'assietes (quantityInput) et les quantité de base (amounts)

/// Quantités dans l'input utilisateur
const quantityInput = document.querySelector("#quantityInput");

/// Quantité initiale défini par l'auteur de la recette
const quantityInit = document.getElementById("quantityInit").textContent;

// Nombres de couverts selectionné (pour les impressions)
const quantitySpan = document.getElementById("quantityDefined")

/// Quantité des ingrédients
const amounts = document.querySelectorAll(".amount");
const amountArray = [];


// Remplir le tableau des quantité amountArray de chaque quantité signalée comme appartenant a amounts (element de class css .amount)
Array.from(amounts).forEach(function (element, index) {
  amountArray.push(Number(element.innerText));
});

// Empecher le rechargement de la page lorsque la touche entrée est presser sur quantityInput
quantityInput.addEventListener('keydown', function (e) {
  if(e.keyIdentifier=='U+000A'||e.keyIdentifier=='Enter'||e.keyCode==13)
  {e.preventDefault();return false;}
},true);



// Lorsque quantityInput change, chaque valeur du tableau amountArray est modifié
  // 'input' agit lorsque la modification se fait au clavier, à la souris ou autre
  // 'change' agit lorsque le focus est perdu ; keyup agit lorsqu'une touche du clavier est relaché
  quantityInput.addEventListener("input", function () {
  amountArray.forEach((value,i) => {
    amounts[i].innerHTML = (value * quantityInput.value) / quantityInit; 
    amounts[i].innerHTML = Math.round(amounts[i].innerHTML * 100) / 100;
    });

  quantityInput.addEventListener("input", function (){
        quantitySpan.textContent = quantityInput.value;
    });



  });

