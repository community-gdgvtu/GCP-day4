import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeWard } from './api';
import {
  Camera, Activity, ChevronRight, AlertCircle, CheckCircle2,
  TerminalSquare, Cpu, Sparkles, Wifi, Zap, Eye, Package,
  BarChart3, RefreshCw, X, User, GraduationCap, Calendar,
  MapPin, Award, Users, Shield, Upload, ChevronDown,
  CircuitBoard, Brain, Database as DatabaseIcon
} from 'lucide-react';

function App() {
  // Main state
  const [logs, setLogs] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeNode, setActiveNode] = useState('ui');
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [activeSource, setActiveSource] = useState('camera');

  // Triage forecaster state
  const [triagePatients, setTriagePatients] = useState(5);
  const [acuityLevel, setAcuityLevel] = useState(4);
  const [selectedWard, setSelectedWard] = useState('emergency');
  const [selectedUnit, setSelectedUnit] = useState('ml');

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const logsEndRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  let welcomeTimer = null;
  let resultTimer = null;

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Auto-dismiss welcome modal after 5 seconds
  useEffect(() => {
    if (showWelcomeModal) {
      welcomeTimer = setTimeout(() => setShowWelcomeModal(false), 5000);
    }
    return () => {
      if (welcomeTimer) clearTimeout(welcomeTimer);
    };
  }, [showWelcomeModal]);

  // Camera initialization
  useEffect(() => {
    const initCamera = async () => {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment'
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          };
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setCameraError("Camera access denied. Please enable camera permissions to use the scan feature.");
        setCameraReady(false);
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (resultTimer) clearTimeout(resultTimer);
    };
  }, []);

  const addLog = useCallback((agent, message, type = 'info') => {
    setLogs(prev => [...prev, {
      agent,
      message,
      type,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    }]);
  }, []);

  // Master AI flow
  const executeAIFlow = async (base64Data, sourceName) => {
    setIsScanning(true);
    setLogs([]);
    setLastAnalysis(null);
    setActiveNode('vision');
    addLog("System", `Received image from ${sourceName}. Sending to Vision Agent...`, "info");

    try {
      const result = await analyzeWard(base64Data);

      if (result.error) {
        addLog("System", `Connection failed: ${result.error}`, "error");
        setActiveNode('ui');
        setIsScanning(false);
        return;
      }

      setLastAnalysis({
        analysis: result.analysis,
        action: result.action,
        item: result.inventory?.item,
        supplier: result.inventory?.supplier
      });

      addLog("Vision Agent", `Analysis: ${result.analysis}`, "success");

      if (result.action) {
        setActiveNode('inventory');
        setTimeout(() => {
          addLog("System", "A2A Protocol Triggered. Querying AlloyDB...", "warning");
          addLog("Inventory Agent", `ScaNN Match: ${result.inventory?.item} from ${result.inventory?.supplier}`, "success");
          addLog("System", "Restock Order Placed Successfully.", "success");
          setActiveNode('complete');
          setShowResultModal(true);
          resultTimer = setTimeout(() => setShowResultModal(false), 5000);
        }, 1500);
      } else {
        addLog("System", "Stock levels are optimal. No action needed.", "info");
        setActiveNode('complete');
        setShowResultModal(true);
        resultTimer = setTimeout(() => setShowResultModal(false), 5000);
      }
    } catch (e) {
      addLog("Error", "Critical system failure. Please try again.", "error");
      setActiveNode('ui');
    } finally {
      setIsScanning(false);
    }
  };

  // Capture from camera
  const handleLiveCapture = () => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) {
      addLog("System", "Camera not ready.", "error");
      return;
    }
    setActiveSource('camera');
    setUploadedImage(null);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    executeAIFlow(base64Data, "Live Webcam");
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result;
      setUploadedImage(resultString);
      setActiveSource('upload');
      const base64Data = resultString.split(',')[1];
      executeAIFlow(base64Data, "File Upload");
    };
    reader.readAsDataURL(file);
  };

  const clearLogs = () => {
    setLogs([]);
    setLastAnalysis(null);
    addLog("System", "Logs cleared. Ready for new scan.", "info");
  };

  // Triage calculations
  const supplyBurnRate = triagePatients * acuityLevel;
  const depletionHours = triagePatients === 0 ? 24 : Math.max(1, Math.floor(120 / (triagePatients * acuityLevel)));
  const isCritical = supplyBurnRate > 40;

  const handlePreemptiveRestock = () => {
    addLog("System", "Manual Preemptive A2A Restock Triggered due to high triage load.", "warning");
    setLastAnalysis({
      analysis: "High patient load detected. Preemptive restock initiated.",
      action: true,
      item: "IV Fluids, Bandages, Painkillers",
      supplier: "Emergency Stockpile"
    });
    setShowResultModal(true);
    resultTimer = setTimeout(() => setShowResultModal(false), 5000);
  };

  // Network node component with neon style
  const NetworkNode = ({ icon: Icon, label, isActive, status }) => (
    <div className="flex flex-col items-center gap-2 transition-all duration-500 group transform hover:scale-110">
      <div className={`
        relative p-3 rounded-2xl border transition-all duration-300 shadow-lg
        ${isActive
          ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)] scale-110'
          : 'bg-slate-800/50 border-slate-700 group-hover:border-purple-500/50 group-hover:shadow-xl group-hover:shadow-purple-500/20'
        }
      `}>
        <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-purple-400'}`} />
        {status && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ring-2 ring-slate-900"></div>
        )}
      </div>
      <span className={`text-[10px] font-semibold tracking-wider uppercase transition-colors ${isActive ? 'text-purple-400' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );

  // Log item component with neon borders
  const LogItem = ({ log }) => {
    const getIcon = () => {
      switch (log.type) {
        case 'error': return <AlertCircle className="w-3 h-3 text-red-400" />;
        case 'warning': return <AlertCircle className="w-3 h-3 text-amber-400" />;
        case 'success': return <CheckCircle2 className="w-3 h-3 text-green-400" />;
        default: return <TerminalSquare className="w-3 h-3 text-purple-400" />;
      }
    };

    return (
      <div className={`
        p-3 rounded-xl bg-slate-950/50 border-l-2 transition-all hover:bg-slate-950
        ${log.type === 'error' ? 'border-red-500 hover:border-red-400' :
          log.type === 'warning' ? 'border-amber-500 hover:border-amber-400' :
            log.type === 'success' ? 'border-green-500 hover:border-green-400' :
              'border-purple-500 hover:border-purple-400'}
      `}>
        <div className="flex items-center justify-between gap-2 text-[10px] opacity-60 mb-1">
          <div className="flex items-center gap-1">
            {getIcon()}
            <span className="font-mono">{log.time}</span>
          </div>
          <span className="font-mono">{log.agent}</span>
        </div>
        <div className="text-xs leading-relaxed font-mono">{log.message}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Animated background circuit grid - using CSS pattern instead of SVG data URL */}
      <div className="fixed inset-0 opacity-20 pointer-events-none circuit-bg"></div>

      {/* Welcome Modal - neon style */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-500 rounded-3xl max-w-md w-full p-8 shadow-2xl animate-fade-in-up transform transition-all hover:scale-105 duration-300">
            <div className="text-center">
              <div className="inline-flex p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full mb-6 animate-pulse">
                <GraduationCap className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent mb-2">
                Hospital Ops Command
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                AI-Powered Inventory Management System
              </p>
              <div className="bg-slate-800/50 rounded-2xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-300">Created by: <span className="font-semibold text-white">Team GDG VTU</span></span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300">Build with AI Series</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">Google Developer Groups on Campus</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300">Visvesvaraya Technological University</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Leveraging Gemini AI, AlloyDB ScaNN, and A2A protocol for intelligent supply chain management.
              </p>
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95"
              >
                Launch Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal - neon style */}
      {showResultModal && lastAnalysis && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-500 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-fade-in-up transform transition-all hover:scale-105 duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                {lastAnalysis.action ? (
                  <div className="p-2 bg-amber-500/20 rounded-full">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                ) : (
                  <div className="p-2 bg-green-500/20 rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                )}
                <h3 className="text-xl font-bold text-white">Scan Result</h3>
              </div>
              <button onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{lastAnalysis.analysis}</p>
              </div>
              {lastAnalysis.action && (
                <div className="border border-amber-500/30 rounded-xl p-4 bg-amber-500/5">
                  <p className="text-sm font-semibold text-amber-400 flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    Action Required
                  </p>
                  <p className="text-sm text-slate-300 mt-2">
                    Restock <span className="font-bold text-purple-400">{lastAnalysis.item}</span> from <span className="font-bold text-pink-400">{lastAnalysis.supplier}</span>
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - neon glow */}
      <header className="relative border-b border-purple-500/30 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Activity className="h-7 w-7 text-purple-400" />
              <div className="absolute inset-0 blur-md bg-purple-400/30 rounded-full"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                Hospital Ops Command
              </h1>
              <p className="text-xs text-slate-500">AI-Powered Inventory Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* GDG on Campus Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 backdrop-blur-sm">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-purple-300 whitespace-nowrap">
                GDG on Campus
              </span>
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span className="text-xs font-medium text-pink-300 whitespace-nowrap">
                Build with AI Series
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-mono">
              <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-slate-400">{cameraReady ? 'CAMERA READY' : 'CAMERA OFFLINE'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 relative">
        {/* Left Column: Live Feed / Upload */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>

            <div className="relative bg-slate-900/80 border border-purple-500/30 rounded-2xl overflow-hidden backdrop-blur-sm transform transition-all hover:scale-[1.01] duration-300">
              <div className="p-5 border-b border-purple-500/30 flex justify-between items-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  {activeSource === 'camera' ? 'Live Ward Feed' : 'Uploaded Image'}
                </h2>
                {uploadedImage && (
                  <button
                    onClick={() => { setUploadedImage(null); setActiveSource('camera'); }}
                    className="text-xs text-purple-400 hover:text-purple-300 transition"
                  >
                    Return to Camera
                  </button>
                )}
              </div>

              <div className="relative aspect-video bg-black/50">
                {activeSource === 'camera' ? (
                  cameraError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-red-400" />
                      <p className="text-red-400 text-sm">{cameraError}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700 transition"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-slate-400">Initializing camera...</span>
                          </div>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                )}
                <canvas ref={canvasRef} className="hidden" />

                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 bg-purple-500/10 animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-[scan_2s_ease-in-out_infinite]"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-[scan_2s_ease-in-out_infinite_reverse]"></div>
                  </div>
                )}
              </div>

              <div className="p-5 flex gap-4">
                <button
                  onClick={handleLiveCapture}
                  disabled={isScanning || !cameraReady}
                  className={`
                    flex-1 py-4 rounded-xl font-bold tracking-wide transition-all duration-300 relative overflow-hidden
                    ${isScanning || !cameraReady
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:shadow-purple-500/25 active:scale-95'
                    }
                  `}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    CAPTURE WEBCAM
                  </span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className={`
                    flex-1 py-4 rounded-xl font-bold tracking-wide transition-all duration-300
                    ${isScanning ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 active:scale-95'}
                  `}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Upload className="w-5 h-5" />
                    UPLOAD IMAGE
                  </span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Agent Architecture Visualizer */}
          <div className="relative bg-slate-900/80 border border-purple-500/30 rounded-2xl p-5 backdrop-blur-sm transform transition-all hover:scale-[1.02] duration-300">
            <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-5 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Agent Routing Map
            </h2>
            <div className="flex items-center justify-between px-2 relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent -translate-y-1/2 pointer-events-none"></div>

              <NetworkNode icon={Camera} label="Frontend" isActive={activeNode === 'ui'} status={cameraReady} />
              <ChevronRight className={`w-4 h-4 transition-all duration-500 ${activeNode !== 'ui' ? 'text-purple-500' : 'text-slate-700'}`} />
              <NetworkNode icon={Brain} label="Vision AI" isActive={activeNode === 'vision' || activeNode === 'inventory' || activeNode === 'complete'} />
              <ChevronRight className={`w-4 h-4 transition-all duration-500 ${activeNode === 'inventory' || activeNode === 'complete' ? 'text-purple-500' : 'text-slate-700'}`} />
              <NetworkNode icon={DatabaseIcon} label="AlloyDB" isActive={activeNode === 'inventory' || activeNode === 'complete'} />
            </div>
            {activeNode === 'complete' && (
              <div className="mt-4 text-center text-xs text-green-400 animate-pulse">
                ✓ Workflow Complete • A2A Protocol Executed
              </div>
            )}
          </div>

          {/* Triage Forecaster - neon style */}
          <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden transform transition-all hover:scale-[1.02] duration-300">
            <div className={`absolute -inset-0.5 bg-red-500/20 blur-2xl transition-opacity duration-500 ${isCritical ? 'opacity-100' : 'opacity-0'}`}></div>

            <div className="relative z-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Predictive Triage Forecaster
              </h2>

              <div className="space-y-5">
                {/* Ward Selector */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Ward</span>
                    <span className="text-purple-400 font-mono">{selectedWard.toUpperCase()}</span>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedWard}
                      onChange={(e) => setSelectedWard(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white appearance-none focus:outline-none focus:border-purple-500 transition"
                    >
                      <option value="emergency">Emergency Department</option>
                      <option value="icu">Intensive Care Unit</option>
                      <option value="surgical">Surgical Ward</option>
                      <option value="pediatric">Pediatric Ward</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Sliders */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
                      <span>Incoming Trauma Patients</span>
                      <span className="text-purple-400 font-bold">{triagePatients}</span>
                    </div>
                    <input
                      type="range" min="0" max="20" value={triagePatients}
                      onChange={(e) => setTriagePatients(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
                      <span>Average Acuity Level (1-10)</span>
                      <span className={`${acuityLevel > 7 ? 'text-red-400' : 'text-amber-400'} font-bold`}>{acuityLevel}</span>
                    </div>
                    <input
                      type="range" min="1" max="10" value={acuityLevel}
                      onChange={(e) => setAcuityLevel(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                {/* Unit Selector */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Supply Units</span>
                    <span className="text-purple-400 font-mono">{selectedUnit}</span>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white appearance-none focus:outline-none focus:border-purple-500 transition"
                    >
                      <option value="ml">Milliliters (ml)</option>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="bags">Bags</option>
                      <option value="units">Units</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Dynamic Calculation Output */}
                <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <div className="text-xs text-slate-500 font-mono mb-2">Estimated Supply Burn Rate:</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">IV Bags Depletion Time:</span>
                    {triagePatients === 0 ? (
                      <span className="text-sm text-green-400 font-mono">Stable (&gt;24h)</span>
                    ) : (
                      <span className={`text-sm font-bold font-mono ${isCritical ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                        {depletionHours} Hours
                      </span>
                    )}
                  </div>

                  {isCritical && (
                    <button
                      onClick={handlePreemptiveRestock}
                      className="mt-4 w-full py-2 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Shield className="w-4 h-4" />
                      FORCE PREEMPTIVE RESTOCK
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Latest Analysis Card */}
          {lastAnalysis && (
            <div className="bg-gradient-to-r from-purple-950/40 to-pink-950/40 border border-purple-500/30 rounded-2xl p-5 backdrop-blur-sm animate-fade-in-up transform transition-all hover:scale-[1.02] duration-300">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4" />
                Latest Analysis
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-slate-300">{lastAnalysis.analysis}</p>
                {lastAnalysis.action && (
                  <div className="mt-3 p-3 bg-slate-950/50 rounded-xl border border-green-500/30">
                    <div className="flex items-center gap-2 text-green-400 text-xs font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      ACTION REQUIRED
                    </div>
                    <p className="text-sm mt-1">
                      Restock <span className="font-bold text-purple-400">{lastAnalysis.item}</span> from <span className="font-bold text-pink-400">{lastAnalysis.supplier}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Terminal Logs */}
          <div className="relative bg-slate-900/80 border border-purple-500/30 rounded-2xl flex-1 flex flex-col overflow-hidden backdrop-blur-sm transform transition-all hover:scale-[1.01] duration-300">
            <div className="p-4 border-b border-purple-500/30 bg-slate-800/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono text-slate-400">system_logs.sh</span>
              </div>
              {logs.length > 0 && (
                <button
                  onClick={clearLogs}
                  className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1 active:scale-95"
                >
                  <RefreshCw className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            <div className="p-4 flex-1 overflow-y-auto font-mono text-sm space-y-3 max-h-[320px] custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-slate-600 flex flex-col items-center justify-center h-full gap-3 py-12">
                  <CircuitBoard className="w-8 h-8 opacity-30" />
                  <span className="text-xs">Awaiting system trigger...</span>
                  <span className="text-[10px] text-slate-700">Click CAPTURE WEBCAM or UPLOAD IMAGE to begin</span>
                </div>
              ) : (
                <>
                  {logs.map((log, i) => (
                    <LogItem key={log.timestamp || i} log={log} />
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-500/30 bg-slate-900/30 backdrop-blur-sm mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-slate-400">Google Developer Groups on Campus</span>
            </div>
            <div className="w-px h-4 bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-purple-400 font-medium">Build with AI Series</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Powered by Gemini AI</span>
            <span>•</span>
            <span>AlloyDB ScaNN Index</span>
            <span>•</span>
            <span>A2A Protocol</span>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { transform: translateY(100%); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes scan-reverse {
          0% { transform: translateY(100%); opacity: 0; }
          50% { transform: translateY(-100%); opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        .animate-[scan_2s_ease-in-out_infinite] {
          animation: scan 2s ease-in-out infinite;
        }
        .animate-[scan_2s_ease-in-out_infinite_reverse] {
          animation: scan-reverse 2s ease-in-out infinite;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .circuit-bg {
          background-image: 
            linear-gradient(rgba(168,85,247,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.1) 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #a855f7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #c084fc;
        }
        button:active {
          transform: scale(0.97);
        }
        input[type="range"] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type="range"]:focus {
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #a855f7;
          cursor: pointer;
          box-shadow: 0 0 6px #a855f7;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          background: #1e293b;
          border-radius: 2px;
        }
      `}} />
    </div>
  );
}

export default App;