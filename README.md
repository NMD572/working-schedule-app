## Firebase Authentication Setup Guide

If you encounter the error ‘auth/configuration-not-found’, it indicates a problem with your Firebase Authentication configuration. Follow these steps to resolve it:

1.  **Go to the Firebase Console:** Navigate to [https://console.firebase.google.com/](https://console.firebase.google.com/) and select your project.

2.1. **Access the Authentication Section:** In the left-hand menu, find "Create" and click on the "Authentication" section.
2.2. **Enable Sign-in Methods:** - If you haven't already set up Authentication, click the "Get started" button. - Go to the "Sign-in method" tab. - Enable the desired sign-in methods (e.g., Email/Password, Google, Anonymous). Click the pencil icon to enable and configure each method. - If using Anonymous sign-in, ensure it is enabled.
2.3. **Save Changes:** Make sure to save any changes you make to the sign-in methods.

3.1. **Access the Firestore Database:** In the left-hand menu, find "Create" and click on the "Firestore Database" section.
3.2. **Choose Region And Create New Database:** You need to choose the region nearby you for the fastest experience.

## Install lib and start app

1. npm install

2. npm install -D tailwindcss@3 (choose specific the version of tailwindcss)

3. npx tailwindcss init -p

4. npm start
