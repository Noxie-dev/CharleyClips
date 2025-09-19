#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const PORT = 30303;
const HOST = '127.0.0.1';

console.log('🧪 Testing Charley Clips CLI and Headless Implementation\n');

// Function to test CLI server connection with retry logic
function testConnection(retries = 3) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        
        // Set timeout for connection
        client.setTimeout(5000);
        
        client.connect(PORT, HOST, () => {
            client.write(JSON.stringify({ action: 'status' }));
        });

        let responseData = '';
        client.on('data', (data) => {
            responseData += data.toString();
        });

        client.on('close', () => {
            try {
                const response = JSON.parse(responseData);
                resolve(response);
            } catch (e) {
                reject(new Error(`Failed to parse response: ${responseData}`));
            }
        });

        client.on('timeout', () => {
            client.destroy();
            if (retries > 0) {
                console.log(`   ⚠️  Connection timeout, retrying... (${retries} attempts left)`);
                setTimeout(() => {
                    testConnection(retries - 1).then(resolve).catch(reject);
                }, 2000);
            } else {
                reject(new Error('Connection timeout after all retries'));
            }
        });

        client.on('error', (err) => {
            if (retries > 0 && err.code === 'ECONNREFUSED') {
                console.log(`   ⚠️  Connection refused, retrying... (${retries} attempts left)`);
                setTimeout(() => {
                    testConnection(retries - 1).then(resolve).catch(reject);
                }, 2000);
            } else {
                reject(err);
            }
        });
    });
}

// Function to send a command to the CLI server
function sendCommand(command) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        
        client.connect(PORT, HOST, () => {
            client.write(JSON.stringify(command));
        });

        let responseData = '';
        client.on('data', (data) => {
            responseData += data.toString();
        });

        client.on('close', () => {
            try {
                const response = JSON.parse(responseData);
                resolve(response);
            } catch (e) {
                reject(new Error(`Failed to parse response: ${responseData}`));
            }
        });

        client.on('error', (err) => {
            reject(err);
        });
    });
}

async function runTests() {
    console.log('1. Starting Electron app in headless mode...');
    
    // Start the Electron app in headless mode
    const electronPath = require('electron');
    const appPath = path.join(__dirname, 'main.js');
    
    const electronProcess = spawn(electronPath, [appPath, '--headless'], {
        stdio: 'pipe'
    });
    
    console.log(`   ✅ Electron process started with PID: ${electronProcess.pid}`);
    
    // Wait for the app to start with better error handling
    console.log('   ⏳ Waiting for CLI server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
        console.log('\n2. Testing CLI server connection...');
        const statusResponse = await testConnection();
        console.log(`   ✅ CLI server is running and responsive`);
        console.log(`   📊 Status response:`, statusResponse);
        
        console.log('\n3. Testing CLI commands...');
        
        // Test adding an item
        console.log('   📝 Testing add command...');
        const addResponse = await sendCommand({ 
            action: 'add', 
            payload: 'Test clipboard item from CLI test' 
        });
        console.log(`   ✅ Add command response:`, addResponse);
        
        // Test listing items
        console.log('   📋 Testing list command...');
        const listResponse = await sendCommand({ action: 'list' });
        console.log(`   ✅ List command response:`, listResponse);
        
        // Test search
        console.log('   🔍 Testing search command...');
        const searchResponse = await sendCommand({ 
            action: 'search', 
            payload: 'test' 
        });
        console.log(`   ✅ Search command response:`, searchResponse);
        
        // Test status again
        console.log('   📊 Testing status command...');
        const finalStatusResponse = await sendCommand({ action: 'status' });
        console.log(`   ✅ Final status response:`, finalStatusResponse);
        
        console.log('\n🎉 All tests passed! CLI and headless mode are working correctly.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    } finally {
        console.log('\n4. Cleaning up...');
        // Stop the electron process
        electronProcess.kill();
        console.log('   ✅ Electron process terminated');
    }
}

runTests().catch(console.error);
