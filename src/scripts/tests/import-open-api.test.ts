import { join } from "path";

import { ComponentsObject, OperationObject, ResponseObject } from "openapi3-ts";

import importOpenApi, {
  generateResponsesDefinition,
  generateRestfulComponent,
  generateSchemasDefinition,
  getArray,
  getObject,
  getParamsInPath,
  getRef,
  getResReqTypes,
  getScalar,
  isReference,
} from "../import-open-api";

describe("scripts/import-open-api", () => {
  it("should parse correctly petstore-expanded.yaml", async () => {
    const data = await importOpenApi(join(__dirname, "./petstore-expanded.yaml"));
    expect(data).toMatchSnapshot();
  });

  describe("isReference", () => {
    it("should return true if the property is a ref", () => {
      const property = {
        $ref: "#/components/schemas/FieldResponse",
      };
      expect(isReference(property)).toBe(true);
    });
    it("should return false if the property is not a ref", () => {
      const property = {
        type: "string",
      };
      expect(isReference(property)).toBe(false);
    });
  });

  describe("getParamsInPath", () => {
    it("should return all params in the path", () => {
      expect(getParamsInPath("/pet/{category}/{name}/")).toEqual(["category", "name"]);
    });
  });

  describe("getScalar", () => {
    [
      { item: { type: "integer" }, expected: "number" },
      { item: { type: "long" }, expected: "number" },
      { item: { type: "int32" }, expected: "number" },
      { item: { type: "int64" }, expected: "number" },
      { item: { type: "float" }, expected: "number" },
      { item: { type: "number" }, expected: "number" },
      { item: { type: "double" }, expected: "number" },
      { item: { type: "boolean" }, expected: "boolean" },
      { item: { type: "array", items: { type: "string" } }, expected: "string[]" },
      { item: { type: "array", items: { type: "integer" } }, expected: "number[]" },
      { item: { type: "array", items: { type: "customType" } }, expected: "any[]" },
      { item: { type: "object", properties: { value: { type: "integer" } } }, expected: "{value?: number}" },
      { item: { type: "object" }, expected: "{}" },
      { item: { type: "object", $ref: "#/components/schemas/Foo" }, expected: "Foo" },
      { item: { type: "string" }, expected: "string" },
      { item: { type: "byte" }, expected: "string" },
      { item: { type: "binary" }, expected: "string" },
      { item: { type: "date" }, expected: "string" },
      { item: { type: "dateTime" }, expected: "string" },
      { item: { type: "date-time" }, expected: "string" },
      { item: { type: "password" }, expected: "string" },
      { item: { type: "string", enum: ["foo", "bar"] }, expected: `"foo" | "bar"` },
      { item: { type: "customType" }, expected: "any" },
    ].map(({ item, expected }) =>
      it(`should return ${expected} as type for ${item.type}`, () => {
        expect(getScalar(item)).toEqual(expected);
      }),
    );
  });

  describe("getRef", () => {
    it("should return the name from `#/components/schemas`", () => {
      expect(getRef("#/components/schemas/foo")).toEqual("Foo");
    });
    it("should return the name from `#/components/responses`", () => {
      expect(getRef("#/components/responses/foo")).toEqual("FooResponse");
    });
    it("should return the name from `#/components/parameters`", () => {
      expect(getRef("#/components/parameters/foo")).toEqual("FooParameter");
    });
    it("should return the name from `#/components/requestBodies`", () => {
      expect(getRef("#/components/requestBodies/foo")).toEqual("FooRequestBody");
    });
    it("should throw if the ref is not in `#/components/schemas`", () => {
      expect(() => getRef("#/somewhere/schemas/foo")).toThrowError(
        "This library only resolve $ref that are include into `#/components/*` for now",
      );
    });
  });

  describe("getArray", () => {
    it("should return an array of number", () => {
      const item = {
        type: "array",
        items: {
          type: "integer",
        },
      };

      expect(getArray(item)).toEqual("number[]");
    });

    it("should return an array of ref", () => {
      const item = {
        type: "array",
        items: {
          $ref: "#/components/schemas/foo",
        },
      };

      expect(getArray(item)).toEqual("Foo[]");
    });
  });

  describe("getObject", () => {
    it("should return the type of a standard object", () => {
      const item = {
        type: "object",
        required: ["name", "age"],
        properties: {
          name: {
            type: "string",
          },
          age: {
            type: "integer",
          },
        },
      };
      expect(getObject(item)).toEqual(`{name: string; age: number}`);
    });

    it("should return the type of an object with optional values", () => {
      const item = {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
          },
          age: {
            type: "integer",
          },
        },
      };
      expect(getObject(item)).toEqual(`{name: string; age?: number}`);
    });

    it("should deal with additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          type: "string",
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: string}`);
    });

    it("should deal with ref additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          $ref: "#/components/schemas/foo",
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: Foo}`);
    });

    it("should deal with ref additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          $ref: "#/components/schemas/foo",
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: Foo}`);
    });

    it("should deal with oneOf additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          oneOf: [{ $ref: "#/components/schemas/foo" }, { $ref: "#/components/schemas/bar" }],
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: Foo | Bar}`);
    });

    it("should deal with array as additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          type: "array",
          items: {
            type: "string",
          },
        },
      };

      expect(getObject(item)).toEqual(`{[key: string]: string[]}`);
    });

    it("should deal with allOf", () => {
      const item = {
        type: "object",
        allOf: [
          { $ref: "#/components/schemas/foo" },
          {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
            },
          },
        ],
      };
      expect(getObject(item)).toEqual(`Foo & {name: string}`);
    });
  });

  describe("generateSchemasDefinition", () => {
    it("should declare an interface for simple object", () => {
      const schema = {
        NewPet: {
          required: ["name"],
          properties: {
            name: {
              type: "string",
            },
            tag: {
              type: "string",
            },
          },
        },
      };
      expect(generateSchemasDefinition(schema)).toContain(`export interface NewPet {name: string; tag?: string}`);
    });

    it("should declare a type for union object", () => {
      const schema = {
        Pet: {
          allOf: [
            { $ref: "#/components/schemas/NewPet" },
            { required: ["id"], properties: { id: { type: "integer", format: "int64" } } },
          ],
        },
      };
      expect(generateSchemasDefinition(schema)).toContain(`export type Pet = NewPet & {id: number};`);
    });

    it("should declare a type for all others types", () => {
      const schema = {
        PetName: {
          type: "string",
        },
      };

      expect(generateSchemasDefinition(schema)).toContain(`export type PetName = string;`);
    });

    it("should deal with aliases", () => {
      const schema = {
        Wolf: {
          $ref: "#/components/schemas/Dog",
        },
      };

      expect(generateSchemasDefinition(schema)).toContain(`export type Wolf = Dog;`);
    });
  });

  describe("generateResponsesDefinition", () => {
    it("should declare an interface for simple object", () => {
      const responses: ComponentsObject["responses"] = {
        JobRun: {
          description: "Job is starting",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  executionID: {
                    description: "ID of the job execution",
                    type: "string",
                  },
                },
              },
            },
          },
        },
      };

      expect(generateResponsesDefinition(responses)).toContain(
        "export interface JobRunResponse {executionID?: string}",
      );
    });

    it("should declare a a type for composed object", () => {
      const responses: ComponentsObject["responses"] = {
        JobRun: {
          description: "Job is starting",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  {
                    type: "object",
                    properties: {
                      executionID: {
                        description: "ID of the job execution",
                        type: "string",
                      },
                    },
                  },
                  { $ref: "#/components/schemas/ExecutionID" },
                ],
              },
            },
          },
        },
      };

      expect(generateResponsesDefinition(responses)).toContain(
        "export type JobRunResponse = {executionID?: string} & ExecutionID",
      );
    });

    it("should declare a a type for union object", () => {
      const responses: ComponentsObject["responses"] = {
        JobRun: {
          description: "Job is starting",
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      executionID: {
                        description: "ID of the job execution",
                        type: "string",
                      },
                    },
                  },
                  { $ref: "#/components/schemas/ExecutionID" },
                ],
              },
            },
          },
        },
      };

      expect(generateResponsesDefinition(responses)).toContain(
        "export type JobRunResponse = {executionID?: string} | ExecutionID",
      );
    });
  });

  describe("getResponseTypes", () => {
    it("should return the type of application/json", () => {
      const responses: Array<[string, ResponseObject]> = [
        [
          "200",
          {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
        ],
      ];

      expect(getResReqTypes(responses)).toEqual("FieldListResponse");
    });

    it("should return the type of application/octet-stream if we don't have application/json response", () => {
      const responses: Array<[string, ResponseObject]> = [
        [
          "200",
          {
            description: "An array of schema fields",
            content: { "application/octet-stream": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
        ],
      ];

      expect(getResReqTypes(responses)).toEqual("FieldListResponse");
    });

    it("should return a union if we have multi responses", () => {
      const responses: Array<[string, ResponseObject]> = [
        [
          "200",
          {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
        ],
        [
          "201",
          {
            description: "An array of schema fields",
            content: {
              "application/json": {
                schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
              },
            },
          },
        ],
      ];

      expect(getResReqTypes(responses)).toEqual("FieldListResponse | {id: string}");
    });

    it("should not generate type duplication", () => {
      const responses: Array<[string, ResponseObject]> = [
        [
          "200",
          {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
        ],
        [
          "201",
          {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
        ],
      ];

      expect(getResReqTypes(responses)).toEqual("FieldListResponse");
    });
  });

  describe("generateGetComponent", () => {
    it("should generate a fully typed component", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(generateRestfulComponent(operation, "get", "/fields", [])).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, APIError>, "path">;

// List all fields for the use case schema
export const ListFields = (props: ListFieldsProps) => (
  <Get<FieldListResponse, APIError>
    path={\`/fields\`}
    {...props}
  />
);

`);
    });

    it("should add a fallback if the error is not defined", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
        },
      };

      expect(generateRestfulComponent(operation, "get", "/fields", [])).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, unknown>, "path">;

// List all fields for the use case schema
export const ListFields = (props: ListFieldsProps) => (
  <Get<FieldListResponse, unknown>
    path={\`/fields\`}
    {...props}
  />
);

`);
    });

    it("should remove duplicate types", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
          "404": {
            description: "file not found or field is not a file type",
            content: { "application/json": { schema: { $ref: "#/components/schemas/APIError" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(generateRestfulComponent(operation, "get", "/fields", [])).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, APIError>, "path">;

// List all fields for the use case schema
export const ListFields = (props: ListFieldsProps) => (
  <Get<FieldListResponse, APIError>
    path={\`/fields\`}
    {...props}
  />
);

`);
    });

    it("should deal with parameters in query", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        parameters: [
          {
            name: "tenantId",
            in: "query",
            required: true,
            description: "The id of the Contiamo tenant",
            schema: { type: "string" },
          },
          {
            name: "projectId",
            in: "query",
            description: "The id of the project",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
          "404": {
            description: "file not found or field is not a file type",
            content: { "application/json": { schema: { $ref: "#/components/schemas/APIError" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(generateRestfulComponent(operation, "get", "/fields", [])).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, APIError>, "path"> & {tenantId: string; projectId?: string};

// List all fields for the use case schema
export const ListFields = ({tenantId, projectId, ...props}: ListFieldsProps) => (
  <Get<FieldListResponse, APIError>
    path={\`/fields?\${qs.stringify({tenantId, projectId})}\`}
    {...props}
  />
);

`);
    });
    it("should deal with parameters in query (root level)", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
          "404": {
            description: "file not found or field is not a file type",
            content: { "application/json": { schema: { $ref: "#/components/schemas/APIError" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(
        generateRestfulComponent(
          operation,
          "get",
          "/fields",
          [],
          [
            {
              name: "tenantId",
              in: "query",
              required: true,
              description: "The id of the Contiamo tenant",
              schema: { type: "string" },
            },
            {
              name: "projectId",
              in: "query",
              description: "The id of the project",
              schema: { type: "string" },
            },
          ],
        ),
      ).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, APIError>, "path"> & {tenantId: string; projectId?: string};

// List all fields for the use case schema
export const ListFields = ({tenantId, projectId, ...props}: ListFieldsProps) => (
  <Get<FieldListResponse, APIError>
    path={\`/fields?\${qs.stringify({tenantId, projectId})}\`}
    {...props}
  />
);

`);
    });

    it("should deal with parameters in path", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        parameters: [
          {
            name: "tenantId",
            in: "path",
            required: true,
            description: "The id of the Contiamo tenant",
            schema: { type: "string" },
          },
          {
            name: "id",
            required: true,
            in: "path",
            description: "The id of the project",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
          "404": {
            description: "file not found or field is not a file type",
            content: { "application/json": { schema: { $ref: "#/components/schemas/APIError" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(generateRestfulComponent(operation, "get", "/fields/{id}", [])).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, APIError>, "path"> & {id: string};

// List all fields for the use case schema
export const ListFields = ({id, ...props}: ListFieldsProps) => (
  <Get<FieldListResponse, APIError>
    path={\`/fields/\${id}\`}
    {...props}
  />
);

`);
    });

    it("should deal with parameters in path (root level)", () => {
      const operation: OperationObject = {
        summary: "List all fields for the use case schema",
        operationId: "listFields",
        tags: ["schema"],
        responses: {
          "200": {
            description: "An array of schema fields",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FieldListResponse" } } },
          },
          "404": {
            description: "file not found or field is not a file type",
            content: { "application/json": { schema: { $ref: "#/components/schemas/APIError" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(
        generateRestfulComponent(
          operation,
          "get",
          "/fields/{id}",
          [],
          [
            {
              name: "tenantId",
              in: "path",
              required: true,
              description: "The id of the Contiamo tenant",
              schema: { type: "string" },
            },
            {
              name: "id",
              required: true,
              in: "path",
              description: "The id of the project",
              schema: { type: "string" },
            },
          ],
        ),
      ).toEqual(`
export type ListFieldsProps = Omit<GetProps<FieldListResponse, APIError>, "path"> & {id: string};

// List all fields for the use case schema
export const ListFields = ({id, ...props}: ListFieldsProps) => (
  <Get<FieldListResponse, APIError>
    path={\`/fields/\${id}\`}
    {...props}
  />
);

`);
    });

    it("should generate a Mutate type component", () => {
      const operation: OperationObject = {
        summary: "Update use case details",
        operationId: "updateUseCase",
        tags: ["use-case"],
        parameters: [
          {
            name: "tenantId",
            in: "path",
            required: true,
            description: "The id of the Contiamo tenant",
            schema: { type: "string" },
          },
          {
            name: "useCaseId",
            in: "path",
            required: true,
            description: "The id of the use case",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UseCaseInstance" } } },
        },
        responses: {
          "204": {
            description: "Use case updated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UseCaseResponse" } } },
          },
          default: {
            description: "unexpected error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: { errors: ["msg1", "msg2"] },
              },
            },
          },
        },
      };

      expect(generateRestfulComponent(operation, "put", "/use-cases/{useCaseId}", [])).toEqual(`
export type UpdateUseCaseProps = Omit<MutateProps<UseCaseResponse, APIError, UseCaseInstance>, "path" | "verb"> & {useCaseId: string};

// Update use case details
export const UpdateUseCase = ({useCaseId, ...props}: UpdateUseCaseProps) => (
  <Mutate<UseCaseResponse, APIError, UseCaseInstance>
    verb="PUT"
    path={\`/use-cases/\${useCaseId}\`}
    {...props}
  />
);

`);
    });
  });
});
