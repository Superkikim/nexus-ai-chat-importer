# Chat Provider Configuration Documentation

This document outlines the standardized process for configuring new chat providers in our system. The configuration uses a YAML format to ensure consistency and ease of integration across different providers.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Mandatory Fields and Their Handling](#mandatory-fields-and-their-handling)
3. [Special Considerations](#special-considerations)
4. [Date and Time Formats](#date-and-time-formats)
5. [File Format](#file-format)
6. [Conversation Schema](#conversation-schema)
7. [Message Schema](#message-schema)
8. [Adding a New Provider](#adding-a-new-provider)
9. [Validation Process](#validation-process)
10. [Example Configuration](#example-configuration)

## Configuration Overview

The provider configuration is structured in YAML format with the following main sections:

```yaml
provider:
    name: ProviderName
    file_format:
        # File format details
    conversation:
        # Conversation schema details
```

Each section serves a specific purpose in defining how the provider's data should be interpreted and processed.

## Mandatory Fields and Their Handling

All fields in the configuration must be present, but some may have null values if the provider doesn't supply that information. Here's how to handle each field:

### Never "null" (Must always have a value):

-   Provider name
-   File format type
-   Filename regex
-   Required files (can be an empty list but not null)
-   Conversation file
-   Conversation ID field name
-   Chat messages field name
-   Message ID field name
-   Message role field name
-   Message content field name

### Can be null if not provided by the provider:

-   Conversation model (use "Unspecified" if not provided)
-   Create time field
-   Create time format
-   Update time field
-   Update time format
-   Message created time field
-   Message created time format
-   Message updated time field
-   Message updated time format
-   Message model (use "Unspecified" if not provided)

Note: When a field is not provided by the provider, use null (without quotes) as the value in the YAML configuration. For model fields, use "Unspecified" if the provider doesn't specify a model.

Example:

```yaml
conversation_model: null # If not provided
message_model: "Unspecified" # If not specified by provider
update_time:
    field: null
    format: null
```

## Special Considerations

1. `file_format.type` must be either "zip" or "json".
2. `conversation.file` must refer to a JSON file.
3. `conversation_model` and `message_model` should be specified, set to "Unspecified", or null if not provided.
4. Date formats must use standard keywords or Moment.js format tokens as specified in the [Date and Time Formats](#date-and-time-formats) section.

## Date and Time Formats

When specifying date and time formats in the configuration, use one of the following:

1. "iso" - ISO 8601 format
2. "unix" - Unix timestamp (seconds since epoch)
3. "rfc2822" - RFC 2822 format
4. "rfc3339" - RFC 3339 format
5. Custom format using Moment.js tokens (e.g., "YYYY-MM-DD HH:mm:ss")

For custom formats, use Moment.js format tokens. Common tokens include:

-   YYYY: 4-digit year
-   MM: 2-digit month
-   DD: 2-digit day of month
-   HH: 2-digit hour (24-hour clock)
-   mm: 2-digit minute
-   ss: 2-digit second

Example usage:

```yaml
create_time:
    field: created_at
    format: iso

update_time:
    field: updated_at
    format: unix

# For custom formats, use Moment.js tokens
last_modified:
    field: last_modified
    format: "YYYY-MM-DD HH:mm:ss"
```

This approach allows direct use of the format string with Moment.js:

```javascript
const moment = require("moment");
const date = moment("2023-04-26 10:30:00", "YYYY-MM-DD HH:mm:ss");
console.log(date.toISOString()); // Outputs: 2023-04-26T10:30:00.000Z
```

For a complete list of format tokens, refer to the Moment.js documentation:
https://momentjs.com/docs/#/parsing/string-format/

Choose the format that best matches your provider's data structure and ensures consistency across your system.

## File Format

```yaml
file_format:
    type: file_type # Must be "zip" or "json"
    filename_regex: "regex_pattern"
    required_files: # Can be an empty list for JSON files, but must be present
        - file1.json
        - file2.json
```

-   `type`: Must be either "zip" or "json".
-   `filename_regex`: A regular expression pattern to validate filenames.
-   `required_files`: A list of required files. For JSON files, this can be an empty list but must be present.

## Conversation Schema

```yaml
conversation:
    file: conversation_file.json # Must be a JSON file
    schema:
        required_fields:
            conversation_id: field_name
            conversation_model: field_name_or_Unspecified_or_null
            create_time:
                field: field_name_or_null
                format: date_format_or_null
            update_time:
                field: field_name_or_null
                format: date_format_or_null
            chat_messages: field_name
```

## Message Schema

```yaml
message_schema:
    message_id: field_name
    role: field_name
    message_content: field_name
    created_at:
        field: field_name_or_null
        format: date_format_or_null
    updated_at:
        field: field_name_or_null
        format: date_format_or_null
    message_model: field_name_or_Unspecified_or_null
```

## Adding a New Provider

To add a new provider:

1. Create a new YAML file named `provider_name.yaml` in the `providers` directory.
2. Fill in the YAML structure with the provider's specific information.
3. Use null for any fields that are not applicable to the provider and are allowed to be null.
4. Ensure all required fields are present and have appropriate values.

## Validation Process

The system validates the provider configuration based on:

1. Presence of all fields in the YAML structure.
2. Correct values for mandatory fields (never null).
3. Appropriate use of null for fields that allow it.
4. Correct specification of file types and formats.
5. Proper use of date format keywords or Moment.js tokens.
6. Correct specification of conversation and message models.

This validation ensures that all provider configurations adhere to the required structure and conventions, maintaining consistency across different providers.

## Example Configuration

Here's an example configuration for a hypothetical provider:

```yaml
provider:
    name: ExampleProvider
    file_format:
        type: zip
        filename_regex: '^data-\d{4}-\d{2}-\d{2}\.zip$'
        required_files:
            - conversations.json
            - users.json
    conversation:
        file: conversations.json
        schema:
            required_fields:
                conversation_id: id
                conversation_model: Unspecified
                create_time:
                    field: created_at
                    format: iso
                update_time:
                    field: updated_at
                    format: unix
                chat_messages: messages
            message_schema:
                message_id: message_id
                role: sender_role
                message_content: content
                created_at:
                    field: timestamp
                    format: unix
                updated_at:
                    field: null
                    format: null
                message_model: Unspecified
```

This configuration demonstrates how to set up a provider that uses a zip file format and has specific mappings for conversation and message fields.

By following this documentation and structure, you can easily add and configure new chat providers while maintaining consistency across the system. Remember that all fields must be present in the configuration, using null for fields that are not applicable to your specific provider only if they are allowed to be null.
