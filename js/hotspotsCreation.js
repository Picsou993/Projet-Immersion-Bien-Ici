import * as THREE from 'three';

const precision = 1;
const maxCameras = 3; //0 or negative values is infinite.


const table = document.getElementById("myTable");

let blockingObjects = [];
let currentVisitedCases;
let grid;
let sceneBoundaries;
let sceneHypotenuse;
let xSize;
let zSize;
let gridOfGridInformation;
let currentX;
let currentY;


function loadSceneObjects(sceneURL) {
    let sceneJSON;
    const loader = new THREE.ObjectLoader();
    const xhr = new XMLHttpRequest();

    xhr.open('GET', sceneURL, false);
    xhr.send();
    if (xhr.status === 200) {
        sceneJSON = JSON.parse(xhr.response);
    } else {
        console.error('An unexpected error has occurred: ' + xhr.statusText);
        return;
    }

    let loadedScene = loader.parse(sceneJSON);
    loadedScene.children.forEach(obj => {
        if (obj.userData !== undefined && obj.userData.blocking === true)
            blockingObjects.push(obj);
    });
    sceneBoundaries = new THREE.Box3().setFromObject(loadedScene);
}

function generateGrid() {
    xSize = Math.round((Math.abs(sceneBoundaries.min.x) + Math.abs(sceneBoundaries.max.x)) / precision);
    zSize = Math.round((Math.abs(sceneBoundaries.min.z) + Math.abs(sceneBoundaries.max.z)) / precision);
    grid = new Array(xSize).fill(0);
    for (let i = 0; i < grid.length; i++) {
        grid[i] = new Array(zSize).fill(0);
    }

    blockingObjects.forEach(object => {
        let tmpBox = new THREE.Box3().setFromObject(object);
        for (let i = 0; i < xSize; i++) {
            for (let j = 0; j < zSize; j++) {
                if (grid[xSize - i - 1][j] === 1) continue;
                if (tmpBox.containsPoint(
                    new THREE.Vector3(
                        i * precision - Math.abs(sceneBoundaries.min.x),
                        0,
                        j * precision - Math.abs(sceneBoundaries.min.z))))
                    grid[xSize - i - 1][j] = 1;
            }
        }
    });

    sceneHypotenuse = Math.sqrt(Math.pow(grid.length, 2) + Math.pow(grid[0].length, 2));
}


function getCamerasPosition() {
    gridOfGridInformation = new Array(grid.length).fill(0);
    for (let i = 0; i < gridOfGridInformation.length; i++) {
        gridOfGridInformation[i] = new Array(grid[0].length).fill(0);
    }

    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[0].length; j++) {
            if (grid[i][j] === 1) continue;
            currentVisitedCases = [];
            gridOfGridInformation[i][j] = getCamerasPosition2(grid, i, j, 0, 0);
        }
        console.log(i / grid.length * 100 + "% done.");
    }

    let bestX;
    let bestY;
    let value = 0;
    for (let i = 0; i < gridOfGridInformation.length; i++) {
        for (let j = 0; j < gridOfGridInformation[0].length; j++) {
            let _value = gridOfGridInformation[i][j][0] / (gridOfGridInformation[i][j][1] * grid.reduce((acc, val) => acc + val.reduce((acc2, val2) => acc2 + (val2 === 0), 0), 0));
            if (_value > value) {
                bestX = i;
                bestY = j;
                value = _value;
            }
        }
    }
    currentX = bestX;
    currentY = bestY;
    grid = deepCopy(gridOfGridInformation[bestX][bestY][2]);
}

function deepCopy(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deepCopy);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, val]) => [key, deepCopy(val)])
        );
    } else {
        return obj;
    }
}

function getCamerasPosition2(_grid, i, j, totalCaseVisited, totalCameras) {
    if (i === -1 || j === -1) return [totalCaseVisited, totalCameras, _grid];
    let tmpGrid = deepCopy(_grid);
    let _tmpCount, _currentVisitedCases;

    tmpGrid[i][j] = 2;
    [_tmpCount, _currentVisitedCases] = setCameraViewableArea(tmpGrid, i, j);
    currentVisitedCases.push(_currentVisitedCases);
    totalCaseVisited += _tmpCount;
    totalCameras++;

    if (totalCameras === maxCameras) return [totalCaseVisited, totalCameras, tmpGrid];

    if (i === tmpGrid.length && j === tmpGrid[0].length) return [totalCaseVisited, totalCameras, tmpGrid];

    let bestVisibilityX = -1;
    let bestVisibilityY = -1;
    let bestVisibilityCount = 0;

    for (const [x, y] of currentVisitedCases[0]) {
        let tmpGrid2 = deepCopy(tmpGrid);
        [_tmpCount, _currentVisitedCases] = setCameraViewableArea(tmpGrid2, x, y);
        if (_tmpCount > bestVisibilityCount) {
            bestVisibilityX = x;
            bestVisibilityY = y;
            bestVisibilityCount = _tmpCount;
        }
    }
    return getCamerasPosition2(tmpGrid, bestVisibilityX, bestVisibilityY, totalCaseVisited, totalCameras);
}


function setCameraViewableArea(tmpGrid, i, j) {
    let countNewVisibility = 0;
    let x, z;
    let visited = [];

    for (x = 0; x < xSize; x++) {
        z = 0;
        countNewVisibility += setLine(tmpGrid, i, j, x, z, visited);
        z = zSize - 1;
        countNewVisibility += setLine(tmpGrid, i, j, x, z, visited);
    }
    for (z = 1; z < zSize - 1; z++) {
        x = 0;
        countNewVisibility += setLine(tmpGrid, i, j, x, z, visited);
        x = xSize - 1;
        countNewVisibility += setLine(tmpGrid, i, j, x, z, visited);
    }
    return [countNewVisibility, visited];
}

function setLine(tmpGrid, x1, z1, x2, z2, visited) {
    let countNewVisibility = 0;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(z2 - z1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = z1 < z2 ? 1 : -1;
    let err = dx - dy;
    let x = x1;
    let y = z1;

    while (true) {
        if (tmpGrid[x][y] === 1) break;
        if (tmpGrid[x][y] === 0) {
            countNewVisibility++;
            tmpGrid[x][y] = 3;
            visited.push([x, y]);
        }
        if (x === x2 && y === z2) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
    return countNewVisibility;
}


function getHotspotsJSONFormatted() {
    let data = [];
    let cameraID = 0;
    for (let i = 0; i < xSize; i++) {
        for (let j = 0; j < zSize; j++) {
            if (grid[i][j] === 2) {
                data.push({
                    "type": "CAMERA",
                    "id": cameraID,
                    "position": {
                        "x": sceneBoundaries.min.x + (i * Math.abs(sceneBoundaries.max.x - sceneBoundaries.min.x) / xSize),
                        "y": 3,
                        "z": sceneBoundaries.min.z + (j * Math.abs(sceneBoundaries.max.z - sceneBoundaries.min.z) / zSize)
                    },
                    "linkedTo": []
                });
                cameraID++;
            }
        }
    }

    return JSON.stringify(data);
}



document.getElementById("saveCameras").addEventListener('click', saveCameras);
function saveCameras() {
    const element = document.createElement('a');
    const file = new Blob([getHotspotsJSONFormatted()], {type: 'application/json'});
    element.setAttribute('href', URL.createObjectURL(file));
    element.setAttribute('download', 'hotspots.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}




loadSceneObjects("scene.json");
generateGrid();
let t1 = Date.now();
getCamerasPosition();
console.log("Time took: ", Date.now() - t1);

drawTable();

window.addEventListener('keydown', keyDown, false);

function keyDown(event) {
    if (event.keyCode === 37) {
        currentX--;
    } else if (event.keyCode === 39) {
        currentX++
    } else if (event.keyCode === 38) {
        currentY--;
    } else if (event.keyCode === 40) {
        currentY++;
    }
    grid = deepCopy(gridOfGridInformation[currentY][currentX][2]);
    drawTable();
}

//===========================================Temp debug=============================================
function drawTable() {
    table.innerHTML = "";
    // Boucle sur les données pour créer les lignes et les colonnes de la table
    for (let i = -1; i < grid.length; i++) {
        const row = document.createElement("tr");
        for (let j = -1; j < grid[i + (i === -1 ? 1 : 0)].length; j++) {
            const cell = document.createElement("td");
            if (i === -1) {
                cell.innerText = "" + j;
            } else if (j === -1) {
                cell.innerText = "" + i;
            } else if (grid[i][j] === 1) {
                cell.classList.add("black");
            } else if (grid[i][j] === 2) {
                cell.classList.add("red");
            } else if (grid[i][j] === 3) {
                cell.classList.add("yellow");
            }
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
}