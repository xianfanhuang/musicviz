# Overview

音影·幻听 (YinYing·HuanTing) is a web-based audio player and visualizer that combines automatic audio format detection with immersive visual effects. The application serves as a comprehensive music player that can handle both encrypted and standard audio formats while providing artistic visualization experiences that respond to music in real-time.

The core functionality centers around two main capabilities: intelligent audio decoding that can automatically detect and decode various audio formats (including encrypted formats from Chinese music platforms), and a sophisticated visualization engine that creates dynamic, interactive visual effects synchronized with the audio.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The application uses a vanilla JavaScript single-page architecture with modular components:

- **HTML Structure**: Simple semantic layout with sections for file upload, URL input, player controls, and visualization canvas
- **CSS Design System**: Uses CSS custom properties for theming with glass morphism effects, gradient backgrounds, and responsive design patterns
- **Component Separation**: Functionality is split into specialized JavaScript modules for maintainability

## Audio Processing Pipeline

The system implements a multi-stage audio processing approach:

- **Format Detection**: Uses magic byte analysis and file extension fallback to identify audio formats
- **Decoding Engine**: Supports both standard formats (MP3, FLAC, WAV, OGG, M4A, AAC) and encrypted formats from Chinese platforms (QMC0/3, NCM, KCM, XM, TM variants, KGM, VPR, MFLAC, MGG)
- **Web Audio API Integration**: Leverages browser's AudioContext for real-time audio analysis and processing

## Network Audio Extraction

The application includes a network sniffer system for extracting audio from various sources:

- **Multi-Platform Support**: Handles URLs from major Chinese music platforms (NetEase, QQ Music, Kugou, Kuwo) and Bilibili
- **CORS Proxy Strategy**: Uses multiple fallback proxy services to bypass cross-origin restrictions
- **Direct Link Detection**: Automatically identifies and processes direct audio file URLs

## Visualization Engine

The visualization system provides multiple artistic rendering modes:

- **Canvas-Based Rendering**: Uses HTML5 Canvas API for hardware-accelerated graphics
- **Real-Time Audio Analysis**: Connects to Web Audio API's AnalyserNode for frequency domain data
- **Multiple Visual Modes**: Supports different artistic styles including cosmic, particle effects, waves, orbs, and fractals
- **Performance Adaptation**: Dynamically adjusts rendering complexity based on device capabilities
- **Color Theme System**: Implements multiple color schemes with smooth transitions

## Data Flow Architecture

The application follows an event-driven architecture:

1. **Input Processing**: File uploads or URL inputs trigger format detection
2. **Audio Decoding**: Detected formats are processed through appropriate decoders
3. **Playback Initialization**: Decoded audio is loaded into the Web Audio API
4. **Visualization Sync**: Audio analysis data drives real-time visual updates
5. **User Interaction**: Controls modify playback state and visual parameters

# External Dependencies

## Browser APIs
- **Web Audio API**: Core audio processing, analysis, and playback functionality
- **HTML5 Canvas API**: Graphics rendering for visualization effects
- **File API**: Local file handling and drag-and-drop support
- **Fetch API**: Network requests for URL-based audio extraction

## Third-Party Services
- **CORS Proxy Services**: Multiple fallback proxies for cross-origin requests
  - api.everyorigin.jwvbremen.nl
  - api.allorigins.win
  - api.cors.lol
  - api.codetabs.com

## Font Resources
- **Google Fonts**: Inter font family for typography

## Platform Integration
- **Music Platform APIs**: Indirect integration with Chinese music platforms (NetEase Cloud Music, QQ Music, Kugou, Kuwo) through URL parsing and extraction
- **Video Platform Support**: Bilibili audio extraction capabilities

## Audio Format Support
- **Standard Formats**: Native browser support for MP3, WAV, OGG, M4A, AAC
- **Encrypted Formats**: Custom decoders for proprietary formats from Chinese music platforms
- **Lossless Formats**: FLAC support for high-quality audio playback