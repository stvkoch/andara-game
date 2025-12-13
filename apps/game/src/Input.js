export class Input {
  constructor(ship) {
    this.ship = ship;
    this.networkClient = null;
    this.lastInputSend = 0;
    this.inputThrottleMs = 100; // Throttle continuous input updates
    
    this.angleInput = document.getElementById('angleInput');
    this.powerInput = document.getElementById('powerInput');
    this.angleDisplay = document.getElementById('angleValue');
    this.powerDisplay = document.getElementById('powerValue');
    this.launchBtn = document.getElementById('launchBtn');
    this.resetBtn = document.getElementById('resetBtn');

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
    // Sync engine controls
    const engineAngleDeg = ((this.ship.engineAngle * 180 / Math.PI) % 360 + 360) % 360;
    this.angleInput.value = Math.round(engineAngleDeg);
    this.angleDisplay.textContent = `${Math.round(engineAngleDeg)}°`;
    this.powerInput.value = Math.round(this.ship.enginePower);
    this.powerDisplay.textContent = `${Math.round(this.ship.enginePower)}%`;

    // Sync weapon controls
    const weaponAngleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
    this.weaponAngleInput.value = Math.round(weaponAngleDeg);
    this.weaponAngleDisplay.textContent = `${Math.round(weaponAngleDeg)}°`;
    this.weaponPowerInput.value = Math.round(this.ship.weaponPower);
    this.weaponPowerDisplay.textContent = `${Math.round(this.ship.weaponPower)}%`;

    // Sync shield controls
    const shieldAngleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
    this.shieldAngleInput.value = Math.round(shieldAngleDeg);
    this.shieldAngleDisplay.textContent = `${Math.round(shieldAngleDeg)}°`;
    this.shieldPowerInput.value = Math.round(this.ship.shieldPower);
    this.shieldPowerDisplay.textContent = `${Math.round(this.ship.shieldPower)}%`;

    // Sync control mode
    this.setMode(this.ship.controlMode);
  }

  syncShipToUI() {
    // Read from ship state and update UI
    // Sync engine controls
    const engineAngleDeg = ((this.ship.engineAngle * 180 / Math.PI) % 360 + 360) % 360;
    this.angleInput.value = Math.round(engineAngleDeg);
    this.angleDisplay.textContent = `${Math.round(engineAngleDeg)}°`;
    this.powerInput.value = Math.round(this.ship.enginePower);
    this.powerDisplay.textContent = `${Math.round(this.ship.enginePower)}%`;

    // Sync weapon controls
    const weaponAngleDeg = ((this.ship.weaponAngle * 180 / Math.PI) % 360 + 360) % 360;
    this.weaponAngleInput.value = Math.round(weaponAngleDeg);
    this.weaponAngleDisplay.textContent = `${Math.round(weaponAngleDeg)}°`;
    this.weaponPowerInput.value = Math.round(this.ship.weaponPower);
    this.weaponPowerDisplay.textContent = `${Math.round(this.ship.weaponPower)}%`;

    // Sync shield controls
    const shieldAngleDeg = ((this.ship.shieldAngle * 180 / Math.PI) % 360 + 360) % 360;
    this.shieldAngleInput.value = Math.round(shieldAngleDeg);
    this.shieldAngleDisplay.textContent = `${Math.round(shieldAngleDeg)}°`;
    this.shieldPowerInput.value = Math.round(this.ship.shieldPower);
    this.shieldPowerDisplay.textContent = `${Math.round(this.ship.shieldPower)}%`;

    // Sync control mode
    this.setMode(this.ship.controlMode);
  }

  setMode(mode) {
      this.ship.controlMode = mode;
      
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

  initListeners() {
    // Mode Switching by Interaction
    const setEngineMode = () => this.setMode('ENGINE');
    const setWeaponMode = () => this.setMode('WEAPON');
    const setShieldMode = () => this.setMode('SHIELD');

    this.engineGroup.addEventListener('click', setEngineMode);
    this.weaponGroup.addEventListener('click', setWeaponMode);
    this.shieldGroup.addEventListener('click', setShieldMode);

    this.angleInput.addEventListener('focus', setEngineMode);
    this.powerInput.addEventListener('focus', setEngineMode);
    this.weaponAngleInput.addEventListener('focus', setWeaponMode);
    this.weaponPowerInput.addEventListener('focus', setWeaponMode);
    this.shieldAngleInput.addEventListener('focus', setShieldMode);
    this.shieldPowerInput.addEventListener('focus', setShieldMode);

    // UI Updates - update ship state only, then sync UI
    this.angleInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.ship.engineAngle = val * (Math.PI / 180);
        this.syncShipToUI();
        this.updatePreview();
        this.sendInputToNetwork();
    });

    this.powerInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.ship.enginePower = val;
        this.syncShipToUI();
        this.sendInputToNetwork();
    });

    // Weapon Listeners
    this.weaponAngleInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.ship.weaponAngle = val * (Math.PI / 180);
        this.syncShipToUI();
        this.sendInputToNetwork();
    });
    this.weaponPowerInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.ship.weaponPower = val;
        this.syncShipToUI();
        this.sendInputToNetwork();
    });
    this.fireBtn.addEventListener('click', () => {
        this.triggerFire();
    });

    // Shield Listeners
    this.shieldAngleInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.ship.shieldAngle = val * (Math.PI / 180);
        this.syncShipToUI();
        this.sendInputToNetwork();
    });
    this.shieldPowerInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.ship.shield.energized) {
          this.ship.energy -= this.ship.shieldPower - val;
        }
        this.ship.shieldPower = val;
        
        this.syncShipToUI();
        this.sendInputToNetwork();
    });
    this.energizeShieldBtn.addEventListener('click', () => {
        this.triggerShield();
    });

    // Buttons
    this.launchBtn.addEventListener('click', () => {
        this.triggerLaunch();
    });

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
            // Update ship state only
            if (this.ship.controlMode === 'ENGINE') {
                this.ship.engineAngle = angleVal * (Math.PI / 180);
                this.ship.enginePower = powerVal;
            } else if (this.ship.controlMode === 'WEAPON') {
                this.ship.weaponAngle = angleVal * (Math.PI / 180);
                this.ship.weaponPower = powerVal;
            } else if (this.ship.controlMode === 'SHIELD') {
                this.ship.shieldAngle = angleVal * (Math.PI / 180);
                this.ship.shieldPower = powerVal;
            }
            
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
    // Toggle shield energized state
    this.ship.shield.energized = !this.ship.shield.energized;
    
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
}
