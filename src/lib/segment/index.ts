import {SEGMENT_API_KEY} from '@env';
import {
  createClient,
  JsonMap,
  SegmentClient,
  UserTraits,
} from '@segment/analytics-react-native';
import {AppsflyerPlugin} from '@segment/analytics-react-native-plugin-appsflyer';
import {IdfaPlugin} from '@segment/analytics-react-native-plugin-idfa';
import {IS_IOS} from '../../constants';
import {APP_ANALYTICS_ENABLED} from '../../constants/config';

/**
 * Client wrapper for the Segment SDK configured for use with the BitPay app.
 * Must call `init()` before any other methods.
 */
const lib = (() => {
  let _client: SegmentClient | null = null;
  const _queue: Array<(client: SegmentClient) => Promise<any>> = [];

  const _addPluginsToClient = (client: SegmentClient) => {
    client.add({
      plugin: new AppsflyerPlugin(),
    });

    if (IS_IOS) {
      client.add({plugin: new IdfaPlugin()});
    }
  };

  /**
   * Guard wrapper that checks if analytics are enabled and client has been initialized before executing the provided callback.
   * @param cb Function to execute if all guards pass.
   * @returns Resolves as void if analytics disabled or if client uninitialized, else returns the callback's return value;
   */
  const guard = <T>(
    cb: (client: SegmentClient) => Promise<T>,
  ): Promise<T | void> => {
    if (!APP_ANALYTICS_ENABLED) {
      return Promise.resolve();
    }

    if (!_client) {
      // Queue up any actions that happen before we get a chance to initialize.
      _queue.push(cb);
      return Promise.resolve();
    }

    return cb(_client);
  };

  return {
    /**
     * Returns an instance of the underlying Segment SDK client, or null if not initialized.
     * @returns {SegmentClient | null} The Segment SDK client.
     */
    getClient(): SegmentClient | null {
      return _client;
    },

    /**
     * Creates and initializes the Segment SDK. Must be called first.
     */
    async init() {
      if (!APP_ANALYTICS_ENABLED) {
        return;
      }

      if (_client) {
        return;
      }

      _client = createClient({
        // Required ---------------

        /**
         * The Segment write key.
         */
        writeKey: SEGMENT_API_KEY,

        // Optional ---------------

        /**
         * When set to false, logs don’t generate.
         */
        debug: !!__DEV__, // default: true

        /**
         * Track app lifecycle events, such as application installed, opened, updated, backgrounded.
         */
        trackAppLifecycleEvents: true, // default: false
      });

      _addPluginsToClient(_client);

      // Clear the queue and run any deferred actions that were called before we got a chance to initialize
      for (let fn = _queue.shift(); fn; fn = _queue.shift()) {
        await fn(_client).catch(() => 0);
      }
    },

    /**
     * Ties a user to their actions and records traits about them.
     *
     * https://segment.com/docs/connections/spec/identify/
     * @param userId Unique identifier for the user in your database.
     * @param traits Free-form dictionary of traits of the user, like `email` or `name`.
     */
    identify(userId?: string | undefined, traits?: UserTraits | undefined) {
      return guard(client => client.identify(userId, traits));
    },

    /**
     * Record whenever a user sees a screen, the mobile equivalent of `page`.
     *
     * https://segment.com/docs/connections/spec/screen/
     * @param name Name of the screen.
     * @param properties Free-form dictionary of properties of the screen, like `name`.
     */
    screen(name: string, properties?: JsonMap | undefined) {
      return guard(client => client.screen(name, properties));
    },

    /**
     * Record any actions your users perform, along with any properties that describe the action.
     *
     * https://segment.com/docs/connections/spec/track/
     * @param event Name of the action that a user has performed.
     * @param properties Free-form dictionary of properties of the event, like `revenue`.
     */
    track(event: string, properties?: JsonMap | undefined) {
      return guard(client => client.track(event, properties));
    },
  };
})();

export default lib;