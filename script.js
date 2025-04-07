// Design constants
const GOLDEN_RATIO = 1.618;
const INVERSE_GOLDEN_RATIO = 0.618;

// Audio Constants and Musical Mappings
const BASE_FREQUENCY = 220.0; // A3 as base frequency
const DRONE_VOLUME = 0.095;  // Volume for the drone oscillator
const NOTE_VOLUME = 0.08;   // Volume for the played notes
let audioContext;
let droneOscillator;
let droneGain;
let droneFilter;
let masterReverb;
let masterGain;
let droneFadeTimeout;

// Audio settings
const REVERB_DURATION = 7.0;  // Increased from 2.5 to 10.0 seconds
const DRONE_FADE_TIME = 1.5; // seconds before drone starts fading
const DRONE_FADE_DURATION = 2; // seconds for fade out duration
const FILTER_FREQUENCY = 300;  // Low pass filter cutoff frequency
const FILTER_Q = 3;  // Filter resonance

// Color variation settings
const COLOR_VARIATIONS = {
    SHADE: 'shade',    // Darker version (add black)
    BASE: 'base',      // Original color
    TINT: 'tint'      // Lighter version (add white)
};

// Octave multipliers for different color variations
const OCTAVE_MAPPINGS = {
    [COLOR_VARIATIONS.SHADE]: 0.5,  // One octave down
    [COLOR_VARIATIONS.BASE]: 0.5,     // Base octave
    [COLOR_VARIATIONS.TINT]: 1      // Same as base (changed from 2)
};

// Background colors for different variations
const BACKGROUND_COLORS = {
    [COLOR_VARIATIONS.SHADE]: '#0a0a0a',  // Slightly darker than base
    [COLOR_VARIATIONS.BASE]: '#0f0f0f',   // Base dark gray
    [COLOR_VARIATIONS.TINT]: '#141414'    // Slightly lighter than base, but still dark
};

// Circle of Fifths mapping (360 degrees mapped to 12 keys)
const DEGREES_PER_KEY = 30; // 360/12
const CIRCLE_OF_FIFTHS = [
    'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'
];

// Scale patterns (intervals from root)
const SCALES = {
    majorPentatonic: [0, 2, 4, 7, 9], // Whole steps: Root, 2nd, 3rd, 5th, 6th
    minorPentatonic: [0, 3, 5, 7, 10] // Whole steps: Root, b3rd, 4th, 5th, b7th
};

// Frequency mapping for notes (relative to A4 = 440Hz)
const NOTE_FREQUENCIES = {
    'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
    'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
    'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

// Layout patterns with dynamic sizing based on design principles
const layoutPatterns = {
    goldenRatio: {
        gridTemplateColumns: `${GOLDEN_RATIO}fr 1fr 1fr`,
        gridTemplateRows: `1fr 1fr`,
        gridTemplateAreas: `
            "a b c"
            "a d e"
        `,
        gap: '0.5rem',
        id: 'goldenRatio'
    },
    ruleOfThirds: {
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: '2fr 1fr',
        gridTemplateAreas: `
            "a a b"
            "c d e"
        `,
        gap: '0.5rem',
        id: 'ruleOfThirds'
    },
    dynamicSplit: {
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gridTemplateAreas: `
            "a b"
            "a c"
            "d e"
        `,
        gap: '0.5rem',
        id: 'dynamicSplit'
    },
    focalPoint: {
        gridTemplateColumns: `${GOLDEN_RATIO}fr 1fr`,
        gridTemplateRows: `${INVERSE_GOLDEN_RATIO}fr 1fr`,
        gridTemplateAreas: `
            "a b"
            "a c"
            "d e"
        `,
        gap: '0.5rem',
        id: 'focalPoint'
    }
};

// Keep track of the last used layout
let lastLayoutId = null;

// Create reverb effect
async function createReverb() {
    const convolver = audioContext.createConvolver();
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * REVERB_DURATION;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    
    // Create a more hall-like impulse response
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            // Early reflections
            const earlyReflections = i < sampleRate * 0.1 ? 0.7 : 0.3;
            
            // Exponential decay with some modulation
            const decay = Math.exp(-i / (sampleRate * 2));
            const modulation = 1 + 0.1 * Math.sin(i * 0.01);
            
            channelData[i] = (Math.random() * 2 - 1) * decay * modulation * earlyReflections;
        }
    }
    
    convolver.buffer = impulse;
    return convolver;
}

// Initialize Audio Context
async function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create master gain and reverb
    masterGain = audioContext.createGain();
    masterReverb = await createReverb();
    
    // Set up audio routing with more wet signal
    const dryGain = audioContext.createGain();
    const wetGain = audioContext.createGain();
    
    dryGain.gain.value = 0.5;  // Changed from 0.7 to 0.5 (50% dry)
    wetGain.gain.value = 0.5;  // Changed from 0.3 to 0.5 (50% wet)
    
    masterGain.connect(dryGain);
    masterGain.connect(masterReverb);
    masterReverb.connect(wetGain);
    
    dryGain.connect(audioContext.destination);
    wetGain.connect(audioContext.destination);
    
    initDrone();
}

// Get musical key from hue
function getKeyFromHue(hue) {
    const keyIndex = Math.floor(hue / DEGREES_PER_KEY);
    return CIRCLE_OF_FIFTHS[keyIndex % 12];
}

// Determine if a color is warm (true) or cool (false)
function isWarmColor(hue) {
    return (hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360);
}

// Get scale frequencies for a given root note and scale type, with octave variation
function getScaleFrequencies(rootNote, isWarm, variation = COLOR_VARIATIONS.BASE) {
    const scalePattern = isWarm ? SCALES.majorPentatonic : SCALES.minorPentatonic;
    const rootFreq = NOTE_FREQUENCIES[rootNote] * OCTAVE_MAPPINGS[variation];
    
    return scalePattern.map(semitones => {
        return rootFreq * Math.pow(2, semitones / 12);
    });
}

// Create color variation (shade or tint)
function createColorVariation(hue, saturation, lightness, variation, variationIntensity = 0) {
    // variationIntensity: -1 to 1, where 0 is the base variation
    switch(variation) {
        case COLOR_VARIATIONS.SHADE:
            // Darker version: reduce lightness, increase saturation slightly
            const shadeIntensity = 0.6 + (variationIntensity * 0.2); // 0.4 to 0.8
            return {
                h: hue,
                s: Math.min(saturation * (1.1 + variationIntensity * 0.1), 100),
                l: Math.max(lightness * shadeIntensity, 15) // Ensure minimum lightness
            };
        case COLOR_VARIATIONS.TINT:
            // Lighter version: increase lightness, reduce saturation slightly
            const tintIntensity = 1.4 + (variationIntensity * 0.2); // 1.2 to 1.6
            return {
                h: hue,
                s: Math.max(saturation * (0.9 - variationIntensity * 0.1), 30), // Ensure minimum saturation
                l: Math.min(lightness * tintIntensity, 85) // Cap maximum lightness
            };
        default:
            // Base color with slight variations
            return {
                h: hue,
                s: Math.min(saturation * (1 + variationIntensity * 0.1), 100),
                l: Math.max(Math.min(lightness * (1 + variationIntensity * 0.1), 80), 20) // Keep within visible range
            };
    }
}

// Initialize and play drone
function initDrone() {
    if (!audioContext) return;

    // Clear any existing fade timeout
    if (droneFadeTimeout) {
        clearTimeout(droneFadeTimeout);
    }

    // Stop existing drone if any
    if (droneOscillator) {
        droneOscillator.stop();
        droneOscillator.disconnect();
    }

    droneOscillator = audioContext.createOscillator();
    droneGain = audioContext.createGain();
    droneFilter = audioContext.createBiquadFilter();
    
    // Set up filter
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = FILTER_FREQUENCY;
    droneFilter.Q.value = FILTER_Q;
    
    droneOscillator.type = 'triangle';
    droneGain.gain.value = DRONE_VOLUME;  // Use DRONE_VOLUME constant
    
    // Connect through filter
    droneOscillator.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);
    
    droneOscillator.start();
    
    // Schedule drone fade out
    scheduleDroneFadeOut();
}

// Schedule the drone fade out
function scheduleDroneFadeOut() {
    const now = audioContext.currentTime;
    
    // Reset gain to initial value
    droneGain.gain.cancelScheduledValues(now);
    droneGain.gain.setValueAtTime(DRONE_VOLUME, now);  // Use DRONE_VOLUME constant
    
    // Schedule the fade out after DRONE_FADE_TIME seconds
    droneFadeTimeout = setTimeout(() => {
        const fadeStartTime = audioContext.currentTime;
        droneGain.gain.setValueAtTime(DRONE_VOLUME, fadeStartTime);  // Use DRONE_VOLUME constant
        droneGain.gain.linearRampToValueAtTime(0, fadeStartTime + DRONE_FADE_DURATION);
    }, DRONE_FADE_TIME * 1000);
}

// Update drone frequency
function updateDrone(key) {
    if (!droneOscillator || !droneFilter) return;
    
    const frequency = NOTE_FREQUENCIES[key] / 4;
    const now = audioContext.currentTime;
    
    // Reset any scheduled fade outs
    if (droneFadeTimeout) {
        clearTimeout(droneFadeTimeout);
    }
    
    // Reset gain and frequency with smooth transitions
    droneGain.gain.cancelScheduledValues(now);
    droneGain.gain.setValueAtTime(DRONE_VOLUME, now);  // Use DRONE_VOLUME constant
    
    // Smooth transition for oscillator frequency
    droneOscillator.frequency.setTargetAtTime(frequency, now, 0.1);
    
    // Adjust filter frequency based on note frequency
    const filterFreq = Math.min(frequency * 4, FILTER_FREQUENCY);
    droneFilter.frequency.setTargetAtTime(filterFreq, now, 0.1);
    
    // Schedule new fade out
    scheduleDroneFadeOut();
}

// Play a note with smooth envelope
function playNote(frequency, delay) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Smoother envelope using NOTE_VOLUME constant
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(NOTE_VOLUME, audioContext.currentTime + delay + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + 0.8);
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    
    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + 1);
}

// Helper function to copy text to clipboard
async function copyToClipboard(text) {
    try {
        // Try the modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            showCopyFeedback(text);
        } else {
            // Fallback for older browsers or non-HTTPS
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';


            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                textArea.remove();
                showCopyFeedback(text);
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                textArea.remove();
            }
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}

// Show feedback when color is copied
function showCopyFeedback(color) {
    // Remove any existing feedback
    const existingFeedback = document.querySelector('.copy-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = 'Color copied!';

    // Create styles for the feedback element
    const styles = {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%) translateY(60px)',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: '500',
        display: 'inline-block',
        margin: '0',
        pointerEvents: 'none'
    };

    // Apply styles
    Object.assign(feedback.style, styles);
    
    // Add to document
    document.body.appendChild(feedback);

    // Trigger animation
    requestAnimationFrame(() => {
        feedback.style.opacity = '1';
        feedback.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Remove feedback
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => feedback.remove(), 300);
    }, 1500);
}

function getRandomLayout(excludeId) {
    const availableLayouts = Object.values(layoutPatterns).filter(layout => layout.id !== excludeId);
    return availableLayouts[Math.floor(Math.random() * availableLayouts.length)];
}

// Create background color based on base hue and variation
function createBackgroundColor(baseHue, variation) {
    switch(variation) {
        case COLOR_VARIATIONS.SHADE:
            return `hsl(${baseHue}, 30%, 8%)`; // Darker with slight saturation
        case COLOR_VARIATIONS.BASE:
            return `hsl(${baseHue}, 12%, 12%)`; // Base with slight saturation
        case COLOR_VARIATIONS.TINT:
            return `hsl(${baseHue}, 10%, 16%)`; // Lighter with slight saturation
    }
}

function generateHarmoniousColors() {
    const mainHueRange = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--main-hue-range'));
    const accentHueRange = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--accent-hue-range'));
    const baseSaturation = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-saturation'));
    const baseLightness = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-lightness'));

    const baseHue = Math.floor(Math.random() * 360);
    document.documentElement.style.setProperty('--palette-base-hue', baseHue);

    // Choose a variation family for this palette
    const variationFamily = Object.values(COLOR_VARIATIONS)[Math.floor(Math.random() * 3)];
    
    // Update background based on variation family and base hue
    document.body.style.backgroundColor = createBackgroundColor(baseHue, variationFamily);

    // Update drone with new key
    const key = getKeyFromHue(baseHue);
    updateDrone(key);
    
    // Determine scale based on color temperature
    const isWarm = isWarmColor(baseHue);
    
    const colors = [];
    // Generate main colors within the chosen variation family
    for (let i = 0; i < 4; i++) {
        const hue = (baseHue + (Math.random() * mainHueRange) - mainHueRange/2 + 360) % 360;
        const saturation = baseSaturation + (Math.random() * 20 - 10);
        const lightness = baseLightness + (Math.random() * 20 - 10);

        // Create variation with intensity based on position
        const variationIntensity = (i - 1.5) / 1.5; // -1 to 1
        const colorVar = createColorVariation(hue, saturation, lightness, variationFamily, variationIntensity);
        
        colors.push({
            color: hslToHex(colorVar.h, colorVar.s, colorVar.l),
            frequency: getScaleFrequencies(key, isWarm, variationFamily)[i],
            variation: variationFamily
        });
    }

    // Generate accent color within the same variation family
    const accentHue = (baseHue + (Math.random() * accentHueRange * 2 - accentHueRange) + 360) % 360;
    const accentSaturation = baseSaturation + (Math.random() * 20 - 10);
    const accentLightness = baseLightness + (Math.random() * 20 - 10);
    
    // Create accent with maximum variation intensity
    const accentVar = createColorVariation(accentHue, accentSaturation, accentLightness, variationFamily, 1);
    
    colors.push({
        color: hslToHex(accentVar.h, accentVar.s, accentVar.l),
        frequency: getScaleFrequencies(key, isWarm, variationFamily)[4],
        variation: variationFamily
    });

    return colors;
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function createDynamicLayout() {
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const aspectRatio = viewportWidth / viewportHeight;

    // Choose layout based on aspect ratio and random factor, but ensure it's different from the last one
    let selectedLayout;

    if (aspectRatio > 1.2) {
        // Wider viewport - prefer horizontal layouts but ensure different from last
        const preferredLayouts = [layoutPatterns.goldenRatio, layoutPatterns.ruleOfThirds];
        selectedLayout = preferredLayouts.find(layout => layout.id !== lastLayoutId);
        if (!selectedLayout || Math.random() > 0.7) { // 30% chance to pick from other layouts
            selectedLayout = getRandomLayout(lastLayoutId);
        }
    } else if (aspectRatio < 0.8) {
        // Taller viewport - prefer vertical layouts but ensure different from last
        const preferredLayouts = [layoutPatterns.dynamicSplit, layoutPatterns.focalPoint];
        selectedLayout = preferredLayouts.find(layout => layout.id !== lastLayoutId);
        if (!selectedLayout || Math.random() > 0.7) { // 30% chance to pick from other layouts
            selectedLayout = getRandomLayout(lastLayoutId);
        }
    } else {
        // Balanced viewport - use any layout except the last one
        selectedLayout = getRandomLayout(lastLayoutId);
    }

    // Update the last used layout ID
    lastLayoutId = selectedLayout.id;
    
    // Add a data attribute to the container for the current layout
    document.querySelector('.color-grid').setAttribute('data-layout', selectedLayout.id);
    
    return selectedLayout;
}

function createPalette() {
    const container = document.querySelector('.color-grid');
    const colorData = generateHarmoniousColors();
    
    container.innerHTML = '';
    
    const selectedLayout = createDynamicLayout();
    Object.assign(container.style, {
        ...selectedLayout,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(1px)'
    });
    
    colorData.forEach(({color, frequency, variation}, index) => {
        const box = document.createElement('div');
        box.className = 'color-box';
        box.style.backgroundColor = color;
        box.style.gridArea = String.fromCharCode(97 + index);
        
        const { color: darkerColor, useBlackText } = createDarkerColor(color, variation);
        
        const info = document.createElement('div');
        info.className = 'color-info';
        Object.assign(info.style, {
            backgroundColor: darkerColor,
            padding: '6px 10px',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Inter", "Helvetica Neue", sans-serif',
            fontSize: '10px',
            fontWeight: '450',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            lineHeight: '1.2'
        });
        
        const hexCode = document.createElement('span');
        hexCode.className = 'color-hex';
        hexCode.textContent = color;
        
        // Set text color for hex code based on variation
        if (variation === COLOR_VARIATIONS.TINT) {
            hexCode.style.color = '#1a1a1a';
            hexCode.style.textShadow = '0 1px 1px rgba(255, 255, 255, 0.15)';
        }
        
        const copyColor = (e) => {
            e.stopPropagation();
            copyToClipboard(color);
            playNote(frequency, 0);
            
            box.classList.add('clicking');
            setTimeout(() => {
                box.classList.remove('clicking');
            }, 300);
        };
        
        box.addEventListener('click', copyColor);
        info.addEventListener('click', copyColor);
        hexCode.addEventListener('click', copyColor);
        
        info.appendChild(hexCode);
        box.appendChild(info);
        container.appendChild(box);
        
        const delay = index * 0.1;
        box.style.animation = `
            fadeIn 0.5s ${delay}s cubic-bezier(0.4, 0, 0.2, 1) both,
            scaleIn 0.4s ${delay + 0.1}s cubic-bezier(0.2, 0.8, 0.2, 1) both
        `;
        
        playNote(frequency, delay);
    });
}

function createDarkerColor(hexColor, variation) {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Adjust darkening factor based on variation
    let darkenFactor;
    let alpha;
    let useBlackText = false;
    
    switch(variation) {
        case COLOR_VARIATIONS.SHADE:
            darkenFactor = 0.6;  // Darker for shade mode
            alpha = 0.95;
            useBlackText = false;
            break;
        case COLOR_VARIATIONS.TINT:
            darkenFactor = 0.8;  // Less dark for tint mode
            alpha = 0.85;
            useBlackText = true;  // Use black text for tint mode
            break;
        default:
            darkenFactor = 0.7;  // Standard darkening for base mode
            alpha = 0.9;
            useBlackText = false;
    }
    
    const darkColor = `rgba(${Math.floor(r * darkenFactor)}, ${Math.floor(g * darkenFactor)}, ${Math.floor(b * darkenFactor)}, ${alpha})`;
    return { color: darkColor, useBlackText };
}

// Initialize palette and event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize audio context immediately
    await initAudio();
    createPalette();
    
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('.color-grid')) {
            createPalette();
        }
    });
});

// Update CSS animations
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .color-box {
            transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        
        .color-box.clicking {
            animation: clickJump 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            transform-origin: center center;
        }
        
        @keyframes clickJump {
            0% { transform: scale(1); }
            50% { transform: scale(0.95); }
            100% { transform: scale(1); }
        }
    </style>
`); 
