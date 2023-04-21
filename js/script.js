import * as THREE from 'three';

const useLinkedTo = false;
const sceneURL = "scene.json";
const hotspotsURL = "hotspots.json";

let minimapPositionX, minimapPositionY, minimapSizeX, minimapSizeY;

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
let camera2D, camera3D;
let previousMousePosition = {x: 0, y: 0};
let isMouseDown = false;
let hotspots;
let currentHotspot;
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock()
let fps;
let sceneHotspots = [];
let sceneBoundaries;

document.body.appendChild(renderer.domElement);

window.addEventListener("resize", resizeScene);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('wheel', onScroll, false);
window.addEventListener('dblclick', onDoubleClick, false)


/**
 * Load a scene from the given Path/URL and add it to {@link scene}.<br>
 * This method also defines the {@link sceneBoundaries}.
 * @param sceneURL Path or URL to the JSON file containing the scene.
 */
function loadScene(sceneURL) {
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
    scene.add(loadedScene);
    sceneBoundaries = new THREE.Box3().setFromObject(loadedScene);
}

/**
 * Load the hotspots from the given Path/URL and add them to {@link hotspots}.
 * @param hotspotsURL Path or URL to the JSON file containing the list of hotspots.
 */
function loadHotspots(hotspotsURL) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', hotspotsURL, false);
    xhr.send();
    if (xhr.status === 200) {
        hotspots = JSON.parse(xhr.response);
    } else {
        console.error('An unexpected error has occurred: ' + xhr.statusText);
    }
}

/**
 * Load {@link camera3D} and {@link camera2D} (minimap) into the scene.<br>
 */
function loadCameras() {
    let sceneBoundariesCenter = new THREE.Vector3();
    sceneBoundaries.getCenter(sceneBoundariesCenter);

    camera3D = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    camera3D.position.set(sceneBoundariesCenter.x, sceneBoundariesCenter.y, sceneBoundariesCenter.z);
    camera3D.lookAt(sceneBoundariesCenter.x, sceneBoundariesCenter.y, sceneBoundariesCenter.z);
    camera3D.name = "3D Camera";

    camera2D = new THREE.OrthographicCamera(sceneBoundaries.min.x - 1, sceneBoundaries.max.x + 1, sceneBoundaries.max.z + 1, sceneBoundaries.min.z - 1, 1, 1000);
    camera2D.position.set(sceneBoundariesCenter.x, sceneBoundariesCenter.y + 20, sceneBoundariesCenter.z);
    camera2D.lookAt(sceneBoundariesCenter.x, sceneBoundariesCenter.y, sceneBoundariesCenter.z);
    camera2D.name = "2D Camera";

    scene.add(camera3D);
    scene.add(camera2D);
}

/**
 * Set {@link isMouseDown} to true and the {@link previousMousePosition} to the current mouse position.
 * @param event JS Event from the EventListener.
 */
function onMouseDown(event) {
    isMouseDown = true;

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

/**
 * Set {@link isMouseDown} to false.
 * @param event JS Event from the EventListener.
 */
function onMouseUp(event) {
    isMouseDown = false;
}

/**
 * @todo Use Yaw and Pitch for rotation.
 * Changes the Yaw and Pitch of the {@link camera3D} based on the scrolling of the mouse.<br>
 * @param event JS Event from the EventListener.
 */
function onMouseMove(event) {
    if (isMouseDown) {
        camera3D.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), (event.clientX - previousMousePosition.x) * 0.005);

        let delta = (event.clientY - previousMousePosition.y) * 0.0025;
        camera3D.rotateX(delta);

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

/**
 * Changes the {@link camera3D} FOV based on the scrolling of the mouse wheel.<br>
 * FOV is limited between 35 and 135.
 * @param event JS Event from the EventListener.
 */
function onScroll(event) {
    if (camera3D.fov > 35 && event.deltaY < 0) {
        camera3D.fov -= 1;
        camera3D.updateProjectionMatrix();
    } else if (camera3D.fov < 135 && event.deltaY > 0) {
        camera3D.fov += 1;
        camera3D.updateProjectionMatrix();
    }
}

/**
 * Teleports to the hotspot the user has double-clicked on.<br>
 * Does nothing if not double-clicked on a hotspot sphere.
 * @param event JS Event from the EventListener.
 */
function onDoubleClick(event) {
    let mouse = new THREE.Vector2();
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    if (event.clientX < minimapPositionX
        || event.clientX > minimapPositionX + minimapSizeX
        || window.innerHeight - event.clientY < minimapPositionY
        || window.innerHeight - event.clientY > minimapPositionY + minimapSizeY) {
        raycaster.setFromCamera(mouse, camera3D);
        sceneHotspots.forEach(sphere => {
            if (raycaster.intersectObject(sphere).length > 0)
                teleportToHotspot(sphere.userData.id)
        });
    } else {

    }
}

/**
 * Redefine variables {@link minimapPositionX}, {@link minimapPositionY}, {@link minimapSizeX}, {@link minimapSizeY} and resize the {@link renderer} to the new window size.
 */
function resizeScene() {
    minimapPositionX = window.innerWidth / 1.25;
    minimapPositionY = window.innerHeight / 1.25
    minimapSizeX = window.innerWidth / 6;
    minimapSizeY = window.innerHeight / 6;
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Initialize the position of the {@link camera3D} by teleport to the first hotspot of {@link hotspots}.<br>
 * If there is no hotspot on the list, then nothing is done.
 */
function initializePosition() {
    if (hotspots.size === 0) return;
    currentHotspot = 0;
    teleportToHotspot(0);
}

/**
 * Teleports the {@link camera3D} to the hotspot matching the hotspotID.<br>
 * If the hotspot is of type HOTSPOT and not CAMERA (meaning that this hotspot is a guidance point), we automatically teleport to the related CAMERA hotspot.<br>
 * If there is no matching hotspot for the given hotspotID, then nothing is done.
 * @param hotspotID ID of the hotspot we want to teleport to.
 */
function teleportToHotspot(hotspotID) {
    let hotspotInformation = getHotspotsInformation(hotspotID);
    let previousCamera = currentHotspot;

    currentHotspot = parseInt(hotspotID);
    if (hotspotInformation.type === "CAMERA") {
        camera3D.position.set(hotspotInformation.position.x, hotspotInformation.position.y, hotspotInformation.position.z);
        if (useLinkedTo)
            displayHotspots(hotspotInformation);
    } else if (hotspotInformation.type === "HOTSPOT")
        teleportToHotspot(parseInt(hotspotInformation.camera1) === previousCamera ? hotspotInformation.camera2 : hotspotInformation.camera1);
}

/**
 * Display the {@link hotspots} into the {@link scene}.<br>
 * Only hotspots from the "linkedTo" list of the hotspot information are displayed.
 * @param hotspotInformation The hotspot information of the hotspot we are rendering from.
 */
function displayHotspots(hotspotInformation) {
    sceneHotspots.forEach(hotspot => {
        scene.remove(hotspot);
    });
    sceneHotspots = [];

    hotspotInformation.linkedTo.forEach(hotspotID => {
        let hotspotPosition = getHotspotsInformation(hotspotID).position;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshBasicMaterial({color: 0x00ff00}));
        sphere.position.set(hotspotPosition.x, hotspotPosition.y, hotspotPosition.z);
        sphere.userData = {"id": hotspotID};
        sceneHotspots.push(sphere);
        scene.add(sphere);
    })
}


/**
 * Retrieves the hotspot information given the hotspot ID.<br>
 * Returns undefined if no hotspot information found from the given hotspot ID.
 * @param hotspotID ID of the hotspot.
 * @returns {*} Hotspot information.
 */
function getHotspotsInformation(hotspotID) {
    let info;
    hotspots.forEach(hotspot => {
        if (parseInt(hotspot.id) !== parseInt(hotspotID)) return;
        info = hotspot;
    });
    return info;
}

/**
 * Render the scene with the 2 cameras.
 */
function render() {
    requestAnimationFrame(render);
    renderer.setClearColor(0x00ddff);

    fps = 1 / clock.getDelta();

    // Render main camera view
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(true);
    renderer.render(scene, camera3D);

    // Render top view camera view
    renderer.setViewport(minimapPositionX, minimapPositionY, minimapSizeX, minimapSizeY);
    renderer.setScissor(minimapPositionX, minimapPositionY, minimapSizeX, minimapSizeY);
    renderer.setScissorTest(true);
    renderer.render(scene, camera2D);
}

loadScene(sceneURL);
loadHotspots(hotspotsURL);
loadCameras();
if (!useLinkedTo) {
    sceneHotspots = [];
    hotspots.forEach(h => {
        let hotspotPosition = h.position;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshBasicMaterial({color: 0x00ff00}));
        sphere.position.set(hotspotPosition.x, hotspotPosition.y, hotspotPosition.z);
        sphere.userData = {"id": h.id};
        sceneHotspots.push(sphere);
        scene.add(sphere);
    })
}
resizeScene();
initializePosition();
render();


//=======================================Debug information displayed on screen========================================
const elementFPS = document.getElementById("fps");
const elementFOV = document.getElementById("fov");
const elementCurrentHotspot = document.getElementById("currentHotspot");

function refreshVisualParams() {
    elementFPS.innerText = "FPS: " + fps.toFixed(0);
    elementFOV.innerText = "FOV: " + camera3D.fov;
    elementCurrentHotspot.innerText = "Hotspot: " + currentHotspot;
}

setInterval(refreshVisualParams, 250);