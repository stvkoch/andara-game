export class Input {
  constructor(ship) {
    this.ship = ship;
    this.networkClient = null;
    this.lastInputSend = 0;
    this.inputThrottleMs = 100; // Throttle continuous input updates
    
    // Shared controls
    this.angleInput = document.getElementById('angleInput');
    this.powerInput = document.getElementById('powerInput');
    this.angleDisplay = document.getElementById('angleValue');
    this.powerDisplay = document.getElementById('powerValue');
    this.actionBtn = document.getElementById('actionBtn');
    this.actionIcon = document.getElementById('actionIcon');
    this.resetBtn = document.getElementById('resetBtn');
    
    // Joystick elements
    this.joystick = document.getElementById('joystick');
    this.joystickKnob = document.getElementById('joystick-knob');
    this.directionNeedle = document.getElementById('directionNeedle');
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickActive = false;
    
    // System selector buttons
    this.engineModeBtn = document.getElementById('engineModeBtn');
    this.weaponModeBtn = document.getElementById('weaponModeBtn');
    this.shieldModeBtn = document.getElementById('shieldModeBtn');
    
    // Legacy buttons (hidden)
    this.launchBtn = document.getElementById('launchBtn');

    // Weapon UI
    this.weaponAngleInput = document.getElementById('weaponAngleInput');
    this.weaponPowerInput = document.getElementById('weaponPowerInput');
    this.weaponAngleDisplay = document.getElementById('weaponAngleValue');
    this.weaponPowerDisplay = document.getElementById('weaponPowerValue');
    this.fireBtn = document.getElementById('fireBtn');

    this.onLaunchCallback = null;
    this.onResetCallback = null;
    this.onFireCallback = null;

    // Shield UI
    this.shieldAngleInput = document.getElementById('shieldAngleInput');
    this.shieldPowerInput = document.getElementById('shieldPowerInput');
    this.shieldAngleDisplay = document.getElementById('shieldAngleValue');
    this.shieldPowerDisplay = document.getElementById('shieldPowerValue');
    this.energizeShieldBtn = document.getElementById('energizeShieldBtn');

    this.engineGroup = document.getElementById('engine-controls');
    this.weaponGroup = document.getElementById('weapon-controls');
    this.shieldGroup = document.getElementById('shield-controls');

    // Initialize UI from ship state
    this.syncUIToShip();

    this.initListeners();
  }

  /**
   * Set network client for multiplayer input
   */
  setNetworkClient(networkClient) {
    this.networkClient = networkClient;
  }

  /**
   * Send input to network client if connected
   */
  sendInputToNetwork() {
    if (!this.networkClient || !this.networkClient.isConnected()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastInputSend < this.inputThrottleMs) {
      return;
    }

    this.lastInputSend = now;

    this.networkClient.sendInput({
      controlMode: this.ship.controlMode,
      engineAngle: this.ship.engineAngle,
      enginePower: this.ship.enginePower,
      weaponAngle: this.ship.weaponAngle,
      weaponPower: this.ship.weaponPower,
      shieldAngle: this.ship.shieldAngle,
      shieldPower: this.ship.shieldPower,
      shouldLaunch: false,
      shouldFire: false,
      shieldEnergized: this.ship.shield.energized
    });
  }

  syncUIToShip() {
    // Update shared controls based on current mode
    let angleDeg, powerVal;
    
    if (this.ship.controlMode === 'ENGINE') {
      angleDeg = ((this.ship.engineAngle * 180 / Math.PI) % 360 + 360) % 360;
      powerVal = this.ship.enginePower;
    } else if (this.ship.controlMode === 'WEAPON') {
      angleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
      powerVal = this.ship.weaponPower;
    } else if (this.ship.controlMode === 'SHIELD') {
      angleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
      powerVal = this.ship.shieldPower;
    }
    
    // Update shared controls
    if (this.angleInput) {
      this.angleInput.value = Math.round(angleDeg);
    }
    if (this.angleDisplay) {
      this.angleDisplay.textContent = `${Math.round(angleDeg)}°`;
    }
    if (this.powerInput) {
      this.powerInput.value = Math.round(powerVal);
    }
    if (this.powerDisplay) {
      this.powerDisplay.textContent = `${Math.round(powerVal)}%`;
    }

    // Sync legacy controls (if they exist)
    if (this.weaponAngleInput) {
      const weaponAngleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.weaponAngleInput.value = Math.round(weaponAngleDeg);
    }
    if (this.weaponAngleDisplay) {
      const weaponAngleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.weaponAngleDisplay.textContent = `${Math.round(weaponAngleDeg)}°`;
    }
    if (this.weaponPowerInput) {
      this.weaponPowerInput.value = Math.round(this.ship.weaponPower);
    }
    if (this.weaponPowerDisplay) {
      this.weaponPowerDisplay.textContent = `${Math.round(this.ship.weaponPower)}%`;
    }

    if (this.shieldAngleInput) {
      const shieldAngleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.shieldAngleInput.value = Math.round(shieldAngleDeg);
    }
    if (this.shieldAngleDisplay) {
      const shieldAngleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.shieldAngleDisplay.textContent = `${Math.round(shieldAngleDeg)}°`;
    }
    if (this.shieldPowerInput) {
      this.shieldPowerInput.value = Math.round(this.ship.shieldPower);
    }
    if (this.shieldPowerDisplay) {
      this.shieldPowerDisplay.textContent = `${Math.round(this.ship.shieldPower)}%`;
    }

    // Sync control mode (updates button states and labels)
    this.setMode(this.ship.controlMode);
  }

  syncShipToUI() {
    // Update shared controls based on current mode
    let angleDeg, powerVal;
    
    if (this.ship.controlMode === 'ENGINE') {
      angleDeg = ((this.ship.engineAngle * 180 / Math.PI) % 360 + 360) % 360;
      powerVal = this.ship.enginePower;
    } else if (this.ship.controlMode === 'WEAPON') {
      angleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
      powerVal = this.ship.weaponPower;
    } else if (this.ship.controlMode === 'SHIELD') {
      angleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
      powerVal = this.ship.shieldPower;
    }
    
    // Update shared controls
    if (this.angleInput) {
      this.angleInput.value = Math.round(angleDeg);
    }
    if (this.angleDisplay) {
      this.angleDisplay.textContent = `${Math.round(angleDeg)}°`;
    }
    if (this.powerInput) {
      this.powerInput.value = Math.round(powerVal);
    }
    if (this.powerDisplay) {
      this.powerDisplay.textContent = `${Math.round(powerVal)}%`;
    }

    // Sync legacy controls (if they exist)
    if (this.weaponAngleInput) {
      const weaponAngleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.weaponAngleInput.value = Math.round(weaponAngleDeg);
    }
    if (this.weaponAngleDisplay) {
      const weaponAngleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.weaponAngleDisplay.textContent = `${Math.round(weaponAngleDeg)}°`;
    }
    if (this.weaponPowerInput) {
      this.weaponPowerInput.value = Math.round(this.ship.weaponPower);
    }
    if (this.weaponPowerDisplay) {
      this.weaponPowerDisplay.textContent = `${Math.round(this.ship.weaponPower)}%`;
    }

    if (this.shieldAngleInput) {
      const shieldAngleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.shieldAngleInput.value = Math.round(shieldAngleDeg);
    }
    if (this.shieldAngleDisplay) {
      const shieldAngleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
      this.shieldAngleDisplay.textContent = `${Math.round(shieldAngleDeg)}°`;
    }
    if (this.shieldPowerInput) {
      this.shieldPowerInput.value = Math.round(this.ship.shieldPower);
    }
    if (this.shieldPowerDisplay) {
      this.shieldPowerDisplay.textContent = `${Math.round(this.ship.shieldPower)}%`;
    }

    // Sync control mode (updates button states and labels)
    this.setMode(this.ship.controlMode);
  }

  setMode(mode) {
    if (this.ship.controlMode === mode) {
      return;
    }

      this.ship.updateState({ controlMode: mode });
      
      // Update system selector buttons
      if (this.engineModeBtn) {
        this.engineModeBtn.classList.remove('active');
        this.weaponModeBtn.classList.remove('active');
        this.shieldModeBtn.classList.remove('active');
        
        if (mode === 'ENGINE') {
          this.engineModeBtn.classList.add('active');
          if (this.actionBtn) {
            this.actionBtn.className = 'action-btn-circle engine-mode';
            if (this.actionIcon) {
              this.actionIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Play icon
            }
          }
        } else if (mode === 'WEAPON') {
          this.weaponModeBtn.classList.add('active');
          if (this.actionBtn) {
            this.actionBtn.className = 'action-btn-circle weapon-mode';
            if (this.actionIcon) {
              this.actionIcon.innerHTML = '<path d="M12 2L2 7L12 12L22 7L12 2Z"/><path d="M2 17L12 22L22 17"/><path d="M2 12L12 17L22 12"/>'; // Crosshair/target icon
            }
          }
        } else if (mode === 'SHIELD') {
          this.shieldModeBtn.classList.add('active');
          if (this.actionBtn) {
            this.actionBtn.className = 'action-btn-circle shield-mode';
            if (this.actionIcon) {
              this.actionIcon.innerHTML = '<path d="M12 2L3 7L12 12L21 7L12 2Z" stroke-linecap="round"/><path d="M12 12L3 17L12 22L21 17L12 12Z" stroke-linecap="round"/>'; // Shield icon
            }
          }
        }
      }
      
      // Legacy group updates (if they exist)
      if (this.engineGroup) {
        this.engineGroup.classList.remove('active-mode');
        this.weaponGroup.classList.remove('active-mode');
        this.shieldGroup.classList.remove('active-mode');

        if (mode === 'ENGINE') {
          this.engineGroup.classList.add('active-mode');
        } else if (mode === 'WEAPON') {
          this.weaponGroup.classList.add('active-mode');
        } else if (mode === 'SHIELD') {
          this.shieldGroup.classList.add('active-mode');
        }
      }
      
      // Update shared controls to show current system values
      this.syncUIToShip();
  }

  initListeners() {
    // Initialize joystick
    this.initJoystick();
    
    // Mode Switching by Icon Buttons
    if (this.engineModeBtn) {
      this.engineModeBtn.addEventListener('click', () => this.setMode('ENGINE'));
    }
    if (this.weaponModeBtn) {
      this.weaponModeBtn.addEventListener('click', () => this.setMode('WEAPON'));
    }
    if (this.shieldModeBtn) {
      this.shieldModeBtn.addEventListener('click', () => this.setMode('SHIELD'));
    }

    // Legacy mode switching (if groups exist)
    if (this.engineGroup) {
      this.engineGroup.addEventListener('click', () => this.setMode('ENGINE'));
      this.weaponGroup.addEventListener('click', () => this.setMode('WEAPON'));
      this.shieldGroup.addEventListener('click', () => this.setMode('SHIELD'));
    }

    // Shared angle input - updates based on current mode (hidden, but kept for compatibility)
    if (this.angleInput) {
      this.angleInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const stateUpdate = {};
        
        if (this.ship.controlMode === 'ENGINE') {
          stateUpdate.engineAngle = val * (Math.PI / 180);
        } else if (this.ship.controlMode === 'WEAPON') {
          stateUpdate.weaponAngle = val * (Math.PI / 180);
        } else if (this.ship.controlMode === 'SHIELD') {
          stateUpdate.shieldAngle = val * (Math.PI / 180);
        }
        
        this.ship.updateState(stateUpdate);
        this.syncShipToUI();
        this.updatePreview();
        this.updateDirectionIndicator();
        this.sendInputToNetwork();
      });
    }

    // Shared power input - updates based on current mode
    if (this.powerInput) {
      this.powerInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const stateUpdate = {};
        
        if (this.ship.controlMode === 'ENGINE') {
          stateUpdate.enginePower = val;
        } else if (this.ship.controlMode === 'WEAPON') {
          stateUpdate.weaponPower = val;
        } else if (this.ship.controlMode === 'SHIELD') {
          const oldShieldPower = this.ship.shieldPower;
          if (this.ship.shield.energized) {
            const energyChange = oldShieldPower - val;
            stateUpdate.shieldPower = val;
            stateUpdate.energy = this.ship.energy - energyChange;
          } else {
            stateUpdate.shieldPower = val;
          }
        }
        
        this.ship.updateState(stateUpdate);
        
        // Update power display
        if (this.powerDisplay) {
          this.powerDisplay.textContent = `${Math.round(val)}%`;
        }
        
        // Update power value display in slider container
        const powerValueDisplay = document.getElementById('powerValue');
        if (powerValueDisplay) {
          powerValueDisplay.textContent = `${Math.round(val)}%`;
        }
        
        this.sendInputToNetwork();
      });
    }

    // Shared action button - triggers action based on current mode
    if (this.actionBtn) {
      this.actionBtn.addEventListener('click', () => {
        if (this.ship.controlMode === 'ENGINE') {
          this.triggerLaunch();
        } else if (this.ship.controlMode === 'WEAPON') {
          this.triggerFire();
        } else if (this.ship.controlMode === 'SHIELD') {
          this.triggerShield();
        }
      });
    }
    
    // Update direction indicator when angle changes
    this.updateDirectionIndicator();

    // Legacy button listeners (if they exist)
    if (this.launchBtn) {
      this.launchBtn.addEventListener('click', () => {
        this.triggerLaunch();
      });
    }
    if (this.fireBtn) {
      this.fireBtn.addEventListener('click', () => {
        this.triggerFire();
      });
    }
    if (this.energizeShieldBtn) {
      this.energizeShieldBtn.addEventListener('click', () => {
        this.triggerShield();
      });
    }

    // Legacy weapon/shield inputs (if they exist, sync with shared controls)
    if (this.weaponAngleInput) {
      this.weaponAngleInput.addEventListener('input', (e) => {
        if (this.ship.controlMode === 'WEAPON') {
          this.angleInput.value = e.target.value;
          this.angleInput.dispatchEvent(new Event('input'));
        }
      });
    }
    if (this.weaponPowerInput) {
      this.weaponPowerInput.addEventListener('input', (e) => {
        if (this.ship.controlMode === 'WEAPON') {
          this.powerInput.value = e.target.value;
          this.powerInput.dispatchEvent(new Event('input'));
        }
      });
    }
    if (this.shieldAngleInput) {
      this.shieldAngleInput.addEventListener('input', (e) => {
        if (this.ship.controlMode === 'SHIELD') {
          this.angleInput.value = e.target.value;
          this.angleInput.dispatchEvent(new Event('input'));
        }
      });
    }
    if (this.shieldPowerInput) {
      this.shieldPowerInput.addEventListener('input', (e) => {
        if (this.ship.controlMode === 'SHIELD') {
          this.powerInput.value = e.target.value;
          this.powerInput.dispatchEvent(new Event('input'));
        }
      });
    }

    this.resetBtn.addEventListener('click', () => {
        if (this.onResetCallback) this.onResetCallback();
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
        // Mode Switching Keys
        if (e.key === 'w' || e.key === 'W') {
            this.setMode('WEAPON');
            return;
        }
        if (e.key === 'e' || e.key === 'E') {
            this.setMode('ENGINE');
            return;
        }
        if (e.key === 's' || e.key === 'S') {
            this.setMode('SHIELD');
            return;
        }

        // Get current values from ship state based on Mode
        let angleVal, powerVal;
        if (this.ship.controlMode === 'ENGINE') {
            angleVal = (this.ship.engineAngle * 180 / Math.PI) % 360;
            if (angleVal < 0) angleVal += 360;
            powerVal = this.ship.enginePower;
        } else if (this.ship.controlMode === 'WEAPON') {
            angleVal = (this.ship.weaponAngle * 180 / Math.PI) % 360;
            if (angleVal < 0) angleVal += 360;
            powerVal = this.ship.weaponPower;
        } else if (this.ship.controlMode === 'SHIELD') {
            // Shield
            angleVal = (this.ship.shieldAngle * 180 / Math.PI) % 360;
            if (angleVal < 0) angleVal += 360;
            powerVal = this.ship.shieldPower;
        }
        
        let changed = false;

        switch(e.code) {
            case 'ArrowLeft':
                angleVal -= 5;
                if (angleVal < 0) angleVal += 360;
                changed = true;
                break;
            case 'ArrowRight':
                angleVal += 5;
                if (angleVal >= 360) angleVal -= 360;
                changed = true;
                break;
            case 'ArrowUp':
                powerVal = Math.min(100, powerVal + 5);
                changed = true;
                break;
            case 'ArrowDown':
                powerVal = Math.max(0, powerVal - 5);
                changed = true;
                break;
            case 'Space':
                e.preventDefault(); 
                if (this.ship.controlMode === 'WEAPON') {
                    this.triggerFire();
                    this.ship.shield.energized && this.triggerShield();
                }
                if (this.ship.controlMode === 'SHIELD') {
                    this.triggerShield();
                }
                if (this.ship.controlMode === 'ENGINE') {
                    this.triggerLaunch();
                }
                
                break;
            case 'Escape':
                e.preventDefault();
                if (this.onResetCallback) this.onResetCallback();
                break;
        }

        if (changed) {
            // Update ship state using updateState
            const stateUpdate = {};
            if (this.ship.controlMode === 'ENGINE') {
                stateUpdate.engineAngle = angleVal * (Math.PI / 180);
                stateUpdate.enginePower = Math.min(100, powerVal);
            } else if (this.ship.controlMode === 'WEAPON') {
                stateUpdate.weaponAngle = angleVal * (Math.PI / 180);
                stateUpdate.weaponPower = Math.min(100, powerVal);
            } else if (this.ship.controlMode === 'SHIELD') {
                stateUpdate.shieldAngle = angleVal * (Math.PI / 180);
                stateUpdate.shieldPower = Math.min(100, powerVal);
                if (this.ship.shield.energized) {
                  const energyChange = Math.min(90, powerVal - this.ship.shieldPower);
                  stateUpdate.energy = Math.min(100, this.ship.energy - energyChange);
                }
            }
            this.ship.updateState(stateUpdate);
            
            // Sync UI from ship state
            this.syncShipToUI();
            
            if (this.ship.controlMode === 'ENGINE') {
                this.updatePreview();
            }
            
            // Send input to network
            this.sendInputToNetwork();
        }
    });
  }

  triggerShield() {
    // Toggle shield energized state using updateState
    const newEnergized = !this.ship.shield.energized;
    this.ship.setShieldState(newEnergized, this.ship.shieldAngle, this.ship.shieldPower);
    
    // Send shield toggle to network
    if (this.networkClient && this.networkClient.isConnected()) {
      this.networkClient.sendInput({
        controlMode: this.ship.controlMode,
        engineAngle: this.ship.engineAngle,
        enginePower: this.ship.enginePower,
        weaponAngle: this.ship.weaponAngle,
        weaponPower: this.ship.weaponPower,
        shieldAngle: this.ship.shieldAngle,
        shieldPower: this.ship.shieldPower,
        shouldLaunch: false,
        shouldFire: false,
        shieldEnergized: this.ship.shield.energized
      });
    }
    
    if (this.onShieldCallback) {
        // Use ship state directly
        const angleRad = this.ship.shieldAngle;
        const power = this.ship.shieldPower / 30; // Scale from 0-100 to 0-10
        
        this.onShieldCallback(angleRad, power);
    }
  }

  triggerLaunch() {
    if (this.onLaunchCallback) {
        // Use ship state directly
        const angleRad = this.ship.engineAngle;
        const power = this.ship.enginePower / 10; // Scale from 0-100 to 0-10
        
        this.onLaunchCallback(angleRad, power);
    }
  }

  onLaunch(cb) {
      this.onLaunchCallback = cb;
  }

  onReset(cb) {
      this.onResetCallback = cb;
  }

  getAngle() {
      return this.ship.engineAngle;
  }

  getWeaponAngle() {
      return this.ship.weaponAngle;
  }

  getShieldParams() {
      return {
          angle: this.ship.shieldAngle,
          power: this.ship.shieldPower
      };
  }

  isFirePressed() {
      // In case we want continuous fire, but button is usually click.
      return false; 
  }

  onFire(cb) {
      this.onFireCallback = cb;
  }

  triggerFire() {
      if (this.onFireCallback) {
          // Use ship state directly
          const angleRad = this.ship.weaponAngle;
          const power = this.ship.weaponPower / 10; // Scale from 0-100 to 0-10
          
          this.onFireCallback(angleRad, power);
      }
  }

  updatePreview() {
      // Placeholder for visual updates
  }
  
  /**
   * Initialize joystick control
   */
  initJoystick() {
    if (!this.joystick || !this.joystickKnob) return;
    
    const joystickRect = this.joystick.getBoundingClientRect();
    this.joystickCenter.x = joystickRect.left + joystickRect.width / 2;
    this.joystickCenter.y = joystickRect.top + joystickRect.height / 2;
    
    let isDragging = false;
    
    const handleStart = (e) => {
      isDragging = true;
      this.joystickActive = true;
      e.preventDefault();
    };
    
    const handleMove = (e) => {
      if (!isDragging) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const dx = clientX - this.joystickCenter.x;
      const dy = clientY - this.joystickCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Limit to joystick radius
      const limitedDistance = Math.min(distance, this.joystickRadius);
      const angle = Math.atan2(dy, dx);
      
      const knobX = Math.cos(angle) * limitedDistance;
      const knobY = Math.sin(angle) * limitedDistance;
      
      this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
      
      // Convert joystick angle to ship angle
      // Joystick: 0° = right, 90° = down, 180° = left, 270° = up
      // Ship: 0° = right, 90° = down, 180° = left, 270° = up (same system)
      const angleRad = angle; // Already in radians from atan2
      
      // Update ship angle based on current mode
      const stateUpdate = {};
      if (this.ship.controlMode === 'ENGINE') {
        stateUpdate.engineAngle = angleRad;
      } else if (this.ship.controlMode === 'WEAPON') {
        stateUpdate.weaponAngle = angleRad;
      } else if (this.ship.controlMode === 'SHIELD') {
        stateUpdate.shieldAngle = angleRad;
      }
      
      this.ship.updateState(stateUpdate);
      
      // Convert to degrees for display (0-360)
      const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
      
      // Update hidden angle input for compatibility
      if (this.angleInput) {
        this.angleInput.value = Math.round(angleDeg);
      }
      
      this.updateDirectionIndicator();
      this.sendInputToNetwork();
    };
    
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      this.joystickActive = false;
      
      // Return knob to center
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    };
    
    // Mouse events - allow dragging from anywhere on joystick
    this.joystick.addEventListener('mousedown', (e) => {
      handleStart(e);
      handleMove(e); // Immediately update position
    });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // Touch events - allow dragging from anywhere on joystick
    this.joystick.addEventListener('touchstart', (e) => {
      handleStart(e);
      handleMove(e); // Immediately update position
    });
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
    
    // Update center on resize
    window.addEventListener('resize', () => {
      const joystickRect = this.joystick.getBoundingClientRect();
      this.joystickCenter.x = joystickRect.left + joystickRect.width / 2;
      this.joystickCenter.y = joystickRect.top + joystickRect.height / 2;
    });
  }
  
  /**
   * Update direction indicator (radar) based on current angle
   */
  updateDirectionIndicator() {
    if (!this.directionNeedle) return;
    
    let angleRad;
    if (this.ship.controlMode === 'ENGINE') {
      angleRad = this.ship.engineAngle;
    } else if (this.ship.controlMode === 'WEAPON') {
      angleRad = this.ship.weaponAngle;
    } else if (this.ship.controlMode === 'SHIELD') {
      angleRad = this.ship.shieldAngle;
    } else {
      return;
    }
    
    // Calculate needle endpoint
    // SVG: 0° points right, 90° points down
    // Ship: 0° points right, 90° points down (same)
    const needleLength = 20;
    const centerX = 30;
    const centerY = 30;
    const endX = centerX + Math.cos(angleRad) * needleLength;
    const endY = centerY + Math.sin(angleRad) * needleLength;
    
    this.directionNeedle.setAttribute('x2', endX);
    this.directionNeedle.setAttribute('y2', endY);
  }
}
