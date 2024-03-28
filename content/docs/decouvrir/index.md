---
weight: 10
title: "Découvrir"
description: "Les premiers pas. Présentation des fonctionnalités. Naviguez sur le site"
icon: "Preview"
date: "2024-01-16T04:36:51+01:00"
lastmod: "2024-01-16T04:36:51+01:00"
draft: false
toc: true
zoomable_img: true
gallery: true
---

Ce site/theme permet de créer des sites de partage de recettes de cuisine (avec calcul des quantités en fonction du nombre de couvert prévu) et la création de menus et série de menus pour des événements se déroulant sur plusieurs jours.

## Fonctionnalités
{{< img_text title="Trouver des recettes" img_content="img/rechercher.png" alt="Rechercher" >}}
Un module de recherche est présent sur la barre de menu en haut de chaque page du site: recherche parmi nom, auteur•ice et spécialité (région)
{{< /img_text >}}

{{< text_img title="Explorer" image="images/doc/explorer.png" alt="Explorer" link="/recettes">}}
La page "Explorer" permet de filtrer les recettes en fonction de différents critères (catégories, régimes spéciaux, ingrédients, saisons, etc. )
{{< /text_img >}}

{{< img_text title="Calculer des quantités" img_content="img/recette-couvert.jpg"  >}}
Sur les pages de recettes, vous pouvez choisir le nombre de couverts pour lequel vous souhaitez cuisiner, et les quantité sont immédiatement recalculé. 
{{< /text_img >}}

{{< text_img title="Allergènes et régimes spéciaux" img_content="img/recette-allergene.jpg">}}
Sur les pages des recettes ou sur les pages événement, la liste des allergènes contenus, ainsi que certains ingrédients (porc, alcool) sont indiqués en haut de la recette, et signaler dans la liste d'ingrédients. Les régimes compatibles sont aussi signalé.
{{< /text_img >}}

{{< img_text title="Préparation alternative" img_content="img/recette-prepalt.jpg">}}
Si l'auteur•ice d'une recette a indiquer qu'il existe une/des recette•s alternative•s (végétarienne, sans-lactose, avec des proportion différentes...), alors celle•s-ci s'affiche•nt en dessous des recettes. 
{{< /img_text >}}

## Les pages événements
<!-- {{< gallery path="event-1" fit="800x800" col_lg="1" caption-position="none" />}} -->
Ces pages événements permettent:

- de rassembler différentes recettes pour le nombre de couvert prévu pour chaque repas / chaque jours.

- de lister l'ensemble des ingrédients nécessaires pour l'ensemble des recettes, avec le calcul des quantités totales pour chaque ingrédient. 

Ces listes sont présentées sous forme de tableaux, classés par type d'ingrédients (fruits et légume, ingrédients sec, frais, etc.). L'objectif est de faciliter l'approvisionnement et l'économat des ingrédients. 
  {{< text_img img_content="img/events-ingredients-date.gif">}}
  - Pour cela, il est possible d'afficher les quantités totales nécessaires de chaque ingrédients sur l'ensemble de l'événement ou pour une période donnée. 
  {{< /text_img >}}
  {{< text_img img_content="img/event-ing-frais.jpg">}}
  - Il est aussi possible d'afficher à part des tableaux concernant uniquement les aliments frais (fruits et légumes, viandes et poissons, autres), sur des intervalles de jours défini (par exemple par tranche de 3 jours). 
  {{< /text_img >}}
  {{< text_img img_content="img/event-ing-detail.jpg">}}
   - Enfin, il est possible d'afficher dans ces tableaux, pour chaque ingrédient, les recettes (jour, horaire, nombre de couvert et quantité) à partir desquelles a été calculé le total affiché.
  {{< /text_img >}}

  {{< text_img title="Des affiches Menus" image="images/doc/affiches-1.png">}}
  - Des affiches de menu sont disponibles pour chaque repas. Il est possible de modifier ce qui s'y affiche, les polices et taille du texte. 
  {{< /text_img  >}}

  {{< img_text title="Trouver un événement" img_content="img/event-search.jpg" >}}
  Un module de recherche est présent dans la barre de menu du haut pour retrouver un événement que vous avez créé,. Il faudra vous souvenir d'au moins 4 lettres du nom de l'événement...

  {{< /img_text  >}}

### Imprimer, exporter en pdf

Une attention particulière a été apporté à la facilitation des impressions ou de l'enregistrement en pdf des pages événements et de leurs différentes parties.

{{% bs/alert info %}}
- [Exemple d'un fichier d'impression des recettes](pdf/print-recette.pdf)
- [Exemple d'un fichier d'impression des liste d'ingrédients](pdf/print-ingredients.pdf)
{{% /bs/alert %}}

{{< text_img img_content="img/event-print-recette.jpg">}}
Les mises en pages pour les impressions diffèrent de ce qui s'affiche à l'écran : les éléments inutiles sont retirés, les pages sont misent en noir et blanc, et différents aspects sont modifiés afin de maximiser les chances que chaque recette tienne sur une seule page.
{{< /text_img >}}


{{< img_text img_content="img/event-modal-print.jpg">}}

Il est possible d'imprimer / exporter en pdf, soit l'ensemble de la page (toutes les recettes et/ou tous les tableaux d'ingrédients), ou chaque recette / tableau d'ingrédient individuellement.
{{< /img_text >}}

{{< gallery path="img_print" col_lg="2" fit="500x500" />}}

{{< text_img img_content="img/event-pdf.jpg" title="Exporter en pdf">}}
Pour créer un fichier pdf d'une page événement, il faut sélectionner "Enregistrer au format pdf" dans les options d'impression de votre navigateur. Il est aussi possible de personnaliser la taille des marge d'impression, ou de choisir les pages à imprimer/exporter.
{{< /text_img >}}



### Exporter les tableaux d'ingrédients dans un pad / fichier excel, etc. 

{{< text_img img_content="img/event-copy-ing.jpg">}}
Il est possible de copier simplement les tableaux des listes d'ingredients pour pouvoir ensuite les coller dans un PAD, un email, un tableur, etc. 
{{< bs/alert light >}}
[Plus d'information ici](/docs/web-tools)
{{< /bs/alert >}}
{{< /text_img >}}

{{< load-photoswipe >}}
