// Test suite for Editor Tab System
// Tests the state machine logic for Edit/Preview/Split View tabs

// Simulate the tab state machine
function createTabStateMachine() {
  let activeTab = 'edit';
  let splitMode = true; // Default to split view

  return {
    getState: () => ({ activeTab, splitMode }),

    // Click Edit tab
    clickEdit: () => {
      splitMode = false;
      activeTab = 'edit';
    },

    // Click Preview tab
    clickPreview: () => {
      splitMode = false;
      activeTab = 'preview';
    },

    // Click Split View tab
    clickSplitView: () => {
      splitMode = !splitMode;
    },

    // Check if Edit tab should show as active
    isEditActive: () => !splitMode && activeTab === 'edit',

    // Check if Preview tab should show as active
    isPreviewActive: () => !splitMode && activeTab === 'preview',

    // Check if Split View tab should show as active
    isSplitActive: () => splitMode,

    // Reset to initial state
    reset: () => {
      activeTab = 'edit';
      splitMode = true;
    }
  };
}

const tests = [
  {
    name: 'Initial state should be split view mode',
    test: (machine) => {
      const state = machine.getState();
      return state.splitMode === true;
    }
  },
  {
    name: 'Split View tab should be active initially',
    test: (machine) => {
      return machine.isSplitActive() === true &&
             machine.isEditActive() === false &&
             machine.isPreviewActive() === false;
    }
  },
  {
    name: 'Clicking Edit should exit split mode and show edit',
    test: (machine) => {
      machine.clickEdit();
      const state = machine.getState();
      return state.splitMode === false &&
             state.activeTab === 'edit' &&
             machine.isEditActive() === true;
    }
  },
  {
    name: 'Clicking Preview from Edit should switch to preview',
    test: (machine) => {
      machine.reset();
      machine.clickEdit();
      machine.clickPreview();
      const state = machine.getState();
      return state.splitMode === false &&
             state.activeTab === 'preview' &&
             machine.isPreviewActive() === true &&
             machine.isEditActive() === false;
    }
  },
  {
    name: 'Clicking Split View from Edit should enter split mode',
    test: (machine) => {
      machine.reset();
      machine.clickEdit();
      machine.clickSplitView();
      return machine.isSplitActive() === true;
    }
  },
  {
    name: 'Clicking Split View from Preview should enter split mode',
    test: (machine) => {
      machine.reset();
      machine.clickPreview();
      machine.clickSplitView();
      return machine.isSplitActive() === true;
    }
  },
  {
    name: 'Clicking Edit from split mode should exit split and show edit',
    test: (machine) => {
      machine.reset(); // starts in split mode
      machine.clickEdit();
      return machine.isSplitActive() === false &&
             machine.isEditActive() === true;
    }
  },
  {
    name: 'Clicking Preview from split mode should exit split and show preview',
    test: (machine) => {
      machine.reset(); // starts in split mode
      machine.clickPreview();
      return machine.isSplitActive() === false &&
             machine.isPreviewActive() === true;
    }
  },
  {
    name: 'Toggling Split View twice should return to non-split mode',
    test: (machine) => {
      machine.reset();
      machine.clickEdit(); // exit split mode
      machine.clickSplitView(); // enter split mode
      machine.clickSplitView(); // exit split mode
      return machine.isSplitActive() === false;
    }
  },
  {
    name: 'Only one tab should be active at a time',
    test: (machine) => {
      machine.reset();
      // In split mode
      let activeCount = [machine.isEditActive(), machine.isPreviewActive(), machine.isSplitActive()].filter(Boolean).length;
      if (activeCount !== 1) return false;

      // In edit mode
      machine.clickEdit();
      activeCount = [machine.isEditActive(), machine.isPreviewActive(), machine.isSplitActive()].filter(Boolean).length;
      if (activeCount !== 1) return false;

      // In preview mode
      machine.clickPreview();
      activeCount = [machine.isEditActive(), machine.isPreviewActive(), machine.isSplitActive()].filter(Boolean).length;
      if (activeCount !== 1) return false;

      return true;
    }
  },
  {
    name: 'Clicking Edit multiple times should stay in edit mode',
    test: (machine) => {
      machine.reset();
      machine.clickEdit();
      machine.clickEdit();
      machine.clickEdit();
      return machine.isEditActive() === true &&
             machine.isSplitActive() === false;
    }
  },
  {
    name: 'Clicking Preview multiple times should stay in preview mode',
    test: (machine) => {
      machine.reset();
      machine.clickPreview();
      machine.clickPreview();
      machine.clickPreview();
      return machine.isPreviewActive() === true &&
             machine.isSplitActive() === false;
    }
  },
  {
    name: 'activeTab should persist when entering and exiting split mode',
    test: (machine) => {
      machine.reset();
      machine.clickEdit();
      const tabBeforeSplit = machine.getState().activeTab;
      machine.clickSplitView(); // enter split
      machine.clickSplitView(); // exit split
      const tabAfterSplit = machine.getState().activeTab;
      return tabBeforeSplit === tabAfterSplit && tabAfterSplit === 'edit';
    }
  },
  {
    name: 'Rapid tab switching should not corrupt state',
    test: (machine) => {
      machine.reset();
      for (let i = 0; i < 100; i++) {
        const action = i % 3;
        if (action === 0) machine.clickEdit();
        else if (action === 1) machine.clickPreview();
        else machine.clickSplitView();
      }
      // State should still be valid
      const state = machine.getState();
      return (state.activeTab === 'edit' || state.activeTab === 'preview') &&
             typeof state.splitMode === 'boolean';
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

console.log('\n🧪 Editor Tab System Tests\n' + '='.repeat(50) + '\n');

tests.forEach((test, index) => {
  const machine = createTabStateMachine();
  try {
    const result = test.test(machine);

    if (result) {
      console.log(`✅ Test ${index + 1}: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${test.name}`);
      console.log(`   Final state: ${JSON.stringify(machine.getState())}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${test.name} (Error)`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed\n`);
  process.exit(1);
}
